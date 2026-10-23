"""
Nudge a prompt's text embedding a little each frame, render an image per frame,
and stitch the frames into a video.

The initial noise latents and seed are held fixed, so the only thing changing
between frames is the conditioning embedding.

Examples:
    python nudge.py "a lighthouse on a cliff at dusk"
    python nudge.py "a lighthouse" --mode scale --factor 1.01 --frames 1000
    python nudge.py "a lighthouse" --mode direction --step 0.002
    python nudge.py "a lighthouse" --mode toward --target "a jellyfish" --frames 300
    python nudge.py "a lighthouse" --mode walk --step 0.01
    python nudge.py "a lighthouse" --mode loop --radius 0.5 --frames 600
    python nudge.py "a lighthouse" --mode loop --target "a jellyfish" --radius 0.3 --frames 600
"""

import argparse
import json
import math
import re
import subprocess
import time
from pathlib import Path

import torch
from diffusers import AutoPipelineForText2Image
from diffusers.utils import logging as diffusers_logging

diffusers_logging.set_verbosity_error()  # SDXL's VAE upcast warns on every frame otherwise

MODELS = {
    # 1-step distilled SDXL, 512x512: ~0.1-0.2s/frame on a 4080.
    "sdxl-turbo": dict(repo="stabilityai/sdxl-turbo", steps=1, guidance=0.0, size=512),
    # Plain SD 1.5: slower (needs ~20 steps) but a single 77x768 embedding.
    "sd15": dict(repo="stable-diffusion-v1-5/stable-diffusion-v1-5", steps=20, guidance=7.5, size=512),
}


def parse_args():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("prompt")
    p.add_argument("--model", choices=MODELS, default="sdxl-turbo")
    p.add_argument("--mode", choices=["scale", "direction", "walk", "toward", "loop"], default="scale",
                   help="scale: e *= factor each frame. direction: drift along one fixed random direction. "
                        "walk: random walk. toward: linear interpolation to --target's embedding. "
                        "loop: a closed loop through the prompt's embedding (and --target's, halfway, if given); "
                        "the video loops seamlessly.")
    p.add_argument("--frames", type=int, default=1000)
    p.add_argument("--factor", type=float, default=1.01, help="per-frame multiplier for --mode scale")
    p.add_argument("--step", type=float, default=0.002,
                   help="per-frame step for direction/walk, as a fraction of the embedding's norm")
    p.add_argument("--radius", type=float, default=0.5,
                   help="--mode loop: circle radius as a fraction of the embedding's norm; with --target, "
                        "how far the loop bulges sideways (0 = straight there and back)")
    p.add_argument("--target", help="second prompt for --mode toward or loop")
    p.add_argument("--no-pooled", action="store_true",
                   help="SDXL only: leave the pooled embedding alone and only nudge the per-token one")
    p.add_argument("--seed", type=int, default=0)
    p.add_argument("--steps", type=int, help="override the model's default inference steps")
    p.add_argument("--guidance", type=float, help="override the model's default guidance scale")
    p.add_argument("--size", type=int, help="override the model's default width/height")
    p.add_argument("--fps", type=int, default=30)
    p.add_argument("--out", type=Path, default=Path(__file__).parent / "out")
    p.add_argument("--name", help="run folder name (default: derived from prompt and mode)")
    p.add_argument("--no-video", action="store_true")
    return p.parse_args()


def load_pipe(model):
    pipe = AutoPipelineForText2Image.from_pretrained(
        MODELS[model]["repo"], torch_dtype=torch.float16, variant="fp16"
    ).to("cuda")
    pipe.set_progress_bar_config(disable=True)
    return pipe


@torch.no_grad()
def encode(pipe, prompt, do_cfg):
    """Returns (embeds, pooled, neg_embeds, neg_pooled); pooled entries are None for SD 1.5."""
    out = pipe.encode_prompt(prompt=prompt, device="cuda", num_images_per_prompt=1,
                             do_classifier_free_guidance=do_cfg, negative_prompt="" if do_cfg else None)
    if len(out) == 4:  # SDXL: (embeds, neg, pooled, neg_pooled)
        embeds, neg, pooled, neg_pooled = out
        return embeds, pooled, neg, neg_pooled
    embeds, neg = out  # SD 1.5
    return embeds, None, neg, None


def nudged(base, pooled, args, target=None, target_pooled=None):
    """Yields (embeds, pooled) for each frame. Math is done in float32 to avoid fp16 drift."""
    e0 = base.float()
    p0 = pooled.float() if pooled is not None else None
    nudge_pooled = p0 is not None and not args.no_pooled
    gen = torch.Generator("cuda").manual_seed(args.seed + 1)

    def unit_like(x):
        d = torch.randn(x.shape, generator=gen, device=x.device)
        return d / d.norm() * x.norm()

    def orth_like(x, d):
        # Random direction with norm |x|, orthogonal to d.
        v = unit_like(x)
        v = v - (v * d).sum() / (d * d).sum() * d
        return v / v.norm() * x.norm()

    def loop_axes(x, t):
        # (d, w): the loop is x + (1 - cos θ)/2 · d + radius · sin θ · w, so θ=π lands on x + d.
        # With a target, d points at it; otherwise it's a random circle of the given radius.
        if t is not None:
            d = t.float() - x
        else:
            d = -2 * args.radius * unit_like(x)
        return d, orth_like(x, d)

    if args.mode == "direction":
        de, dp = unit_like(e0), unit_like(p0) if nudge_pooled else None
    if args.mode == "loop":
        ed, ew = loop_axes(e0, target)
        pd, pw = loop_axes(p0, target_pooled) if nudge_pooled else (None, None)
    e, p = e0.clone(), p0.clone() if p0 is not None else None

    for i in range(args.frames):
        if args.mode == "scale":
            s = args.factor ** i
            e = e0 * s
            if nudge_pooled:
                p = p0 * s
        elif args.mode == "direction":
            e = e0 + i * args.step * de
            if nudge_pooled:
                p = p0 + i * args.step * dp
        elif args.mode == "walk":
            if i > 0:
                e = e + args.step * unit_like(e0)
                if nudge_pooled:
                    p = p + args.step * unit_like(p0)
        elif args.mode == "toward":
            t = i / max(args.frames - 1, 1)
            e = torch.lerp(e0, target.float(), t)
            if nudge_pooled:
                p = torch.lerp(p0, target_pooled.float(), t)
        elif args.mode == "loop":
            # Passes through e0 at theta=0 (and the target at theta=pi); frame N would equal frame 0.
            theta = 2 * math.pi * i / args.frames
            a, b = (1 - math.cos(theta)) / 2, args.radius * math.sin(theta)
            e = e0 + a * ed + b * ew
            if nudge_pooled:
                p = p0 + a * pd + b * pw
        yield e.half(), (p.half() if p is not None else None)


def main():
    args = parse_args()
    if args.mode == "toward" and not args.target:
        raise SystemExit("--mode toward needs --target")
    cfg = MODELS[args.model]
    steps = args.steps or cfg["steps"]
    guidance = cfg["guidance"] if args.guidance is None else args.guidance
    size = args.size or cfg["size"]
    do_cfg = guidance > 1.0

    name = args.name or f"{re.sub(r'[^a-z0-9]+', '-', args.prompt.lower()).strip('-')[:40]}_{args.mode}_s{args.seed}"
    run_dir = args.out / name
    frames_dir = run_dir / "frames"
    frames_dir.mkdir(parents=True, exist_ok=True)
    (run_dir / "config.json").write_text(json.dumps(
        {**{k: str(v) if isinstance(v, Path) else v for k, v in vars(args).items()},
         "steps": steps, "guidance": guidance, "size": size}, indent=2))

    pipe = load_pipe(args.model)
    embeds, pooled, neg, neg_pooled = encode(pipe, args.prompt, do_cfg)
    target = target_pooled = None
    if args.target and args.mode in ("toward", "loop"):
        target, target_pooled, _, _ = encode(pipe, args.target, do_cfg)

    # Fixed starting noise so only the embedding varies between frames.
    latent_ch = pipe.unet.config.in_channels
    scale = pipe.vae_scale_factor
    latents = torch.randn((1, latent_ch, size // scale, size // scale),
                          generator=torch.Generator("cuda").manual_seed(args.seed),
                          device="cuda", dtype=torch.float16)

    t0 = time.time()
    for i, (e, p) in enumerate(nudged(embeds, pooled, args, target, target_pooled)):
        path = frames_dir / f"frame_{i:05d}.png"
        if path.exists():  # resume support: frame embeddings are deterministic
            continue
        kw = dict(prompt_embeds=e, num_inference_steps=steps, guidance_scale=guidance,
                  width=size, height=size, latents=latents.clone(),
                  generator=torch.Generator("cuda").manual_seed(args.seed))
        if p is not None:
            kw["pooled_prompt_embeds"] = p
        if do_cfg:
            kw["negative_prompt_embeds"] = neg
            if neg_pooled is not None:
                kw["negative_pooled_prompt_embeds"] = neg_pooled
        pipe(**kw).images[0].save(path)
        if i % 25 == 0 or i == args.frames - 1:
            el = time.time() - t0
            print(f"frame {i + 1}/{args.frames}  |e|={e.float().norm():.1f}  {el:.0f}s elapsed")

    if not args.no_video:
        video = run_dir / f"{name}.mp4"
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(args.fps),
                        "-i", str(frames_dir / "frame_%05d.png"),
                        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", str(video)], check=True)
        print(f"wrote {video}")


if __name__ == "__main__":
    main()
