# cinema-diffuse

Nudge a prompt's text embedding a little every frame, render each frame with a
diffusion model, and stitch the frames into a video. The seed and starting noise
stay the same for every frame, so the embedding is the only thing that changes.

## Setup (Windows, CUDA GPU)

```bash
py -3.12 -m venv .venv
.venv/Scripts/python -m pip install torch --index-url https://download.pytorch.org/whl/cu128
.venv/Scripts/python -m pip install -r requirements.txt
```

The model weights download from Hugging Face on the first run: about 7 GB for SDXL-Turbo.
You also need `ffmpeg` on PATH to stitch the video.

## Usage

```bash
.venv/Scripts/python nudge.py "a lighthouse on a cliff at dusk" --factor 1.01 --frames 1000
```

The output goes to `out/<name>/frames/*.png`, `out/<name>/<name>.mp4` and `config.json`.
If you re-run with the same arguments, frames that already exist are skipped, so a run
you interrupt picks up where it stopped.

Modes (`--mode`):
- `scale`: `e *= factor` each frame, so frame i is `e0 * factor**i`. Note that
  `1.01**1000 ≈ 21000`, so with SDXL-Turbo the image is mostly noise by frame ~200.
  Use `--factor 1.002` to stretch the change over 1000 frames.
- `direction`: drift along one fixed random direction. `--step` is a fraction of `|e0|` per frame.
- `walk`: a random walk with a new random step each frame.
- `toward`: linear interpolation to the embedding of `--target "other prompt"`.
- `loop`: a circle through `e0` in a random 2D plane,
  `e = e0 + r·((cos θ − 1)·u + sin θ·v)`. Frame 0 is the exact prompt, and the last frame
  is one step away from it, so the video loops seamlessly. `--radius` is a fraction of `|e0|`.
  With `--target`, the loop becomes `e = e0 + (1 − cos θ)/2·(e1 − e0) + r·sin θ·w`, where `w` is a
  random direction perpendicular to `e1 − e0`. It passes through the target exactly halfway
  through the video, going out on one side and coming back on the other. Here `--radius`
  sets how far the loop bulges sideways, and `0` goes straight there and back.

### Batch mode

Startup takes about 15–20 s, mostly importing diffusers and loading 7 GB of weights onto the GPU.
To render several runs and pay that cost only once, put one run's arguments on each line of a
text file (`#` starts a comment) and pass the file to `--batch`:

```bash
.venv/Scripts/python nudge.py --batch runs.example.txt --frames 300
```

Any other arguments on the command line become defaults for every line, and a line can
override them. If a line has a bad flag or fails validation, the script skips it and keeps
going, and prints a summary at the end.

### Other knobs

`--model sd15` (one 77x768 embedding instead of SDXL's two),
`--no-pooled` (SDXL only: nudge only the per-token embedding and leave the pooled one alone),
`--seed`, `--steps`, `--guidance`, `--size` and `--fps`.

SDXL-Turbo renders 512px frames in one step, at about 0.2 s per frame on an RTX 4080.
A 1000-frame run takes about 3.5 minutes.
