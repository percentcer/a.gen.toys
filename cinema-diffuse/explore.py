"""
Fly through a 3D grid slice of a prompt's embedding space.

Grid cell (x, y, z) renders the embedding e0 + x*X + y*Y + z*Z, where e0 is the
prompt's embedding and X/Y/Z are three directions. By default these are random
(and orthogonal); --x/--y/--z "some prompt" instead points an axis at another
prompt's embedding, so --cells steps along it lands exactly on that prompt.

The image only depends on your position. The side panel shows the grid from
your camera: moves snap to whichever grid axis is closest to where you're
looking. Rendered cells are cached, and neighbors are pre-rendered while idle.

Controls:
    W/S          forward / back        A/D   strafe left / right
    Q/E          down / up             right mouse (hold)  look around
    Home         back to origin        P     save the current image
    Esc          quit (saves the flight path to the session folder)

Examples:
    python explore.py "a lighthouse on a cliff at dusk"
    python explore.py "a lighthouse on a cliff at dusk" --x "a jellyfish" --y "a forest" --cells 8
"""

import argparse
import json
import math
import threading
import time
from collections import OrderedDict
from pathlib import Path

import pygame
import torch

from nudge import MODELS, encode, fixed_latents, load_pipe, render_frame

AXIS_NAMES = "XYZ"
AXIS_COLORS = [(235, 90, 90), (90, 210, 110), (100, 150, 255)]


def parse_args():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("prompt")
    p.add_argument("--model", choices=MODELS, default="sdxl-turbo")
    for a in "xyz":
        p.add_argument(f"--{a}", metavar="PROMPT", help=f"point the {a.upper()} axis at this prompt's embedding")
    p.add_argument("--cells", type=int, default=10, help="steps along a prompt axis to reach that prompt")
    p.add_argument("--step", type=float, default=0.05,
                   help="cell size along random axes, as a fraction of the embedding's norm")
    p.add_argument("--no-pooled", action="store_true",
                   help="SDXL only: leave the pooled embedding alone and only move the per-token one")
    p.add_argument("--seed", type=int, default=0)
    p.add_argument("--steps", type=int, help="override the model's default inference steps")
    p.add_argument("--guidance", type=float, help="override the model's default guidance scale")
    p.add_argument("--size", type=int, help="override the model's default width/height")
    p.add_argument("--display", type=int, default=768, help="on-screen image size in pixels")
    p.add_argument("--cache", type=int, default=1500, help="max rendered cells kept in memory")
    p.add_argument("--out", type=Path, default=Path(__file__).parent / "out" / "explore")
    return p.parse_args()


class Space:
    """Maps grid cells to embeddings and renders them."""

    def __init__(self, args):
        cfg = MODELS[args.model]
        self.steps = args.steps or cfg["steps"]
        self.guidance = cfg["guidance"] if args.guidance is None else args.guidance
        self.size = args.size or cfg["size"]
        self.seed = args.seed
        do_cfg = self.guidance > 1.0

        self.pipe = load_pipe(args.model)
        e0, p0, self.neg, self.neg_pooled = encode(self.pipe, args.prompt, do_cfg)
        self.e0 = e0.float()
        self.p0 = p0.float() if p0 is not None and not args.no_pooled else None
        self.p_fixed = p0  # used as-is when pooled isn't moved
        self.latents = fixed_latents(self.pipe, self.size, args.seed)

        gen = torch.Generator("cuda").manual_seed(args.seed + 1)
        self.axes, self.labels = [], []
        random_dirs = []  # (e, p) of random axes so far, kept mutually orthogonal
        for name, axis_prompt in zip(AXIS_NAMES, (args.x, args.y, args.z)):
            if axis_prompt:
                e1, p1, _, _ = encode(self.pipe, axis_prompt, do_cfg)
                de = (e1.float() - self.e0) / args.cells
                dp = (p1.float() - self.p0) / args.cells if self.p0 is not None else None
                self.labels.append(f"{axis_prompt} @ {args.cells}")
            else:
                de = self._random_dir(self.e0, [d[0] for d in random_dirs], gen) * args.step
                dp = None
                if self.p0 is not None:
                    dp = self._random_dir(self.p0, [d[1] for d in random_dirs], gen) * args.step
                random_dirs.append((de, dp))
                self.labels.append("random")
            self.axes.append((de, dp))

    @staticmethod
    def _random_dir(x, others, gen):
        # Random direction with norm |x|, orthogonal to the other random axes.
        v = torch.randn(x.shape, generator=gen, device=x.device)
        for o in others:
            v = v - (v * o).sum() / (o * o).sum() * o
        return v / v.norm() * x.norm()

    def render(self, cell):
        e = self.e0.clone()
        p = self.p0.clone() if self.p0 is not None else None
        for c, (de, dp) in zip(cell, self.axes):
            e += c * de
            if p is not None:
                p += c * dp
        p = p.half() if p is not None else self.p_fixed
        return render_frame(self.pipe, e.half(), p, self.neg, self.neg_pooled, self.latents,
                            self.seed, self.steps, self.guidance, self.size)


class Renderer(threading.Thread):
    """Renders the current cell first, then pre-renders neighbors while idle."""

    def __init__(self, space, cache_size):
        super().__init__(daemon=True)
        self.space = space
        self.cache = OrderedDict()  # cell -> PIL image, in LRU order
        self.cache_size = cache_size
        self.lock = threading.Lock()
        self.current = (0, 0, 0)
        self.priority = []  # neighbor offsets, most likely next move first
        self.busy_with = None
        self.running = True

    def get(self, cell):
        with self.lock:
            img = self.cache.get(cell)
            if img is not None:
                self.cache.move_to_end(cell)
            return img

    def _next_job(self):
        with self.lock:
            cur, offsets = self.current, list(self.priority)
            for off in [(0, 0, 0)] + offsets:
                cell = tuple(c + o for c, o in zip(cur, off))
                if cell not in self.cache:
                    return cell
        return None

    def run(self):
        while self.running:
            cell = self._next_job()
            if cell is None:
                time.sleep(0.01)
                continue
            self.busy_with = cell
            img = self.space.render(cell)
            with self.lock:
                self.cache[cell] = img
                while len(self.cache) > self.cache_size:
                    self.cache.popitem(last=False)
            self.busy_with = None


def look_vectors(yaw, pitch):
    """Forward/right/up unit vectors in grid space (z is up)."""
    cp = math.cos(pitch)
    f = (cp * math.cos(yaw), cp * math.sin(yaw), math.sin(pitch))
    r = (math.sin(yaw), -math.cos(yaw), 0.0)
    u = (r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0])
    return f, r, u


def snap(v):
    """Unit grid step along the axis most aligned with v."""
    i = max(range(3), key=lambda k: abs(v[k]))
    step = [0, 0, 0]
    step[i] = 1 if v[i] > 0 else -1
    return tuple(step)


def step_label(step, labels):
    i = next(k for k in range(3) if step[k])
    return f"{'+' if step[i] > 0 else '-'}{AXIS_NAMES[i]}", AXIS_COLORS[i], labels[i]


def draw_lattice(surf, rect, pos, f, r, u, renderer, font, radius=3):
    """Chase-cam view of the grid around you: dots for cells, lit if rendered."""
    surf.fill((18, 18, 24), rect)
    prev_clip = surf.get_clip()
    surf.set_clip(rect)
    cx, cy = rect.centerx, rect.centery
    focal = rect.width * 0.6
    # Sit a little behind and above the current cell so it and its axes stay visible.
    eye = tuple(p - 2.2 * fi + 0.8 * ui for p, fi, ui in zip(pos, f, u))

    def project(pt):
        v = tuple(a - b for a, b in zip(pt, eye))
        z = sum(a * b for a, b in zip(v, f))
        if z < 0.15:
            return None
        x = sum(a * b for a, b in zip(v, r))
        y = sum(a * b for a, b in zip(v, u))
        return cx + x / z * focal, cy - y / z * focal, z

    # Axis lines through the current cell.
    for i, color in enumerate(AXIS_COLORS):
        for sign in (1, -1):
            for t in range(radius):
                a = list(pos); b = list(pos)
                a[i] += sign * t; b[i] += sign * (t + 1)
                pa, pb = project(a), project(b)
                if pa and pb:
                    pygame.draw.line(surf, [c // (1 + t) for c in color], pa[:2], pb[:2], 2)
            end = list(pos); end[i] += sign * radius
            pe = project(end)
            if pe and rect.collidepoint(pe[0], pe[1]):
                label = font.render(f"{'+' if sign > 0 else '-'}{AXIS_NAMES[i]}", True, color)
                surf.blit(label, (pe[0] + 4, pe[1] - 8))

    dots = []
    for dx in range(-radius, radius + 1):
        for dy in range(-radius, radius + 1):
            for dz in range(-radius, radius + 1):
                cell = (pos[0] + dx, pos[1] + dy, pos[2] + dz)
                pr = project(cell)
                if pr and rect.collidepoint(pr[0], pr[1]):
                    dots.append((pr, cell))
    for (x, y, z), cell in sorted(dots, key=lambda d: -d[0][2]):  # far to near
        rendered = cell in renderer.cache
        if cell == (0, 0, 0):
            color, size = (240, 200, 80), 6
        elif rendered:
            color, size = (210, 225, 255), 5
        else:
            color, size = (55, 55, 68), 3
        pygame.draw.circle(surf, color, (x, y), max(1.5, size / z))
        if cell == tuple(pos):
            pygame.draw.circle(surf, (255, 255, 255), (x, y), max(5, 14 / z), 2)
    surf.set_clip(prev_clip)
    pygame.draw.rect(surf, (60, 60, 75), rect, 1)


def main():
    args = parse_args()
    session = args.out / time.strftime("%Y%m%d-%H%M%S")

    pygame.init()
    panel_w = 360
    screen = pygame.display.set_mode((args.display + panel_w, args.display))
    pygame.display.set_caption("cinema-diffuse explorer")
    font = pygame.font.SysFont("consolas", 15)
    big = pygame.font.SysFont("consolas", 22)
    screen.fill((10, 10, 14))
    screen.blit(big.render("loading model...", True, (200, 200, 200)), (20, 20))
    pygame.display.flip()

    space = Space(args)
    renderer = Renderer(space, args.cache)
    renderer.start()

    pos = (0, 0, 0)
    yaw, pitch = 0.0, 0.0
    path = [pos]
    shown_cell, shown_surf = None, None
    last_move = 0.0
    move_keys = {pygame.K_w: "f", pygame.K_s: "b", pygame.K_d: "r", pygame.K_a: "l",
                 pygame.K_e: "u", pygame.K_q: "d"}
    clock = pygame.time.Clock()
    looking = False

    def move_step(kind, f, r):
        return {"f": snap(f), "b": snap(tuple(-c for c in f)), "r": snap(r),
                "l": snap(tuple(-c for c in r)), "u": (0, 0, 1), "d": (0, 0, -1)}[kind]

    running = True
    while running:
        now = time.time()
        f, r, u = look_vectors(yaw, pitch)
        moved_by_key = None
        for ev in pygame.event.get():
            if ev.type == pygame.QUIT or (ev.type == pygame.KEYDOWN and ev.key == pygame.K_ESCAPE):
                running = False
            elif ev.type == pygame.KEYDOWN and ev.key in move_keys:
                moved_by_key = move_keys[ev.key]
            elif ev.type == pygame.KEYDOWN and ev.key == pygame.K_HOME:
                pos = (0, 0, 0); path.append(pos)
            elif ev.type == pygame.KEYDOWN and ev.key == pygame.K_p:
                img = renderer.get(pos)
                if img is not None:
                    session.mkdir(parents=True, exist_ok=True)
                    img.save(session / f"cell_{pos[0]}_{pos[1]}_{pos[2]}.png")
            elif ev.type == pygame.MOUSEBUTTONDOWN and ev.button == 3:
                looking = True
                pygame.event.set_grab(True); pygame.mouse.set_visible(False); pygame.mouse.get_rel()
            elif ev.type == pygame.MOUSEBUTTONUP and ev.button == 3:
                looking = False
                pygame.event.set_grab(False); pygame.mouse.set_visible(True)

        if looking:
            dx, dy = pygame.mouse.get_rel()
            yaw -= dx * 0.004
            pitch = max(-1.5, min(1.5, pitch - dy * 0.004))
            f, r, u = look_vectors(yaw, pitch)

        # A key press always moves; holding a key keeps moving once the current cell is on screen.
        kind = moved_by_key
        if kind is None and now - last_move > 0.12 and renderer.get(pos) is not None:
            held = pygame.key.get_pressed()
            kind = next((k for key, k in move_keys.items() if held[key]), None)
        if kind is not None:
            step = move_step(kind, f, r)
            pos = tuple(a + b for a, b in zip(pos, step))
            path.append(pos)
            last_move = now

        # Tell the renderer where we are and what we'd likely do next.
        fwd = snap(f)
        others = [move_step(k, f, r) for k in "brlud"]
        with renderer.lock:
            renderer.current = pos
            renderer.priority = [fwd] + [s for s in others if s != fwd] + [tuple(2 * c for c in fwd)]

        img = renderer.get(pos)
        if img is not None and shown_cell != pos:
            surf = pygame.image.frombytes(img.tobytes(), img.size, "RGB")
            shown_surf = pygame.transform.smoothscale(surf, (args.display, args.display))
            shown_cell = pos

        # Draw.
        screen.fill((10, 10, 14))
        if shown_surf:
            screen.blit(shown_surf, (0, 0))
        if shown_cell != pos:
            dots = "." * (1 + int(now * 3) % 3)
            screen.blit(big.render(f"rendering{dots}", True, (255, 255, 255), (0, 0, 0)), (12, 12))

        px = args.display + 12
        lattice = pygame.Rect(px, 12, panel_w - 24, panel_w - 24)
        draw_lattice(screen, lattice, pos, f, r, u, renderer, font)
        y = lattice.bottom + 14
        lines = [
            (f"pos  x={pos[0]:+d}  y={pos[1]:+d}  z={pos[2]:+d}", (230, 230, 230)),
            (f"look yaw={math.degrees(yaw) % 360:5.1f}  pitch={math.degrees(pitch):+5.1f}", (170, 170, 170)),
            ("", None),
        ]
        for key, kind in (("W", "f"), ("S", "b"), ("A", "l"), ("D", "r"), ("Q", "d"), ("E", "u")):
            name, color, label = step_label(move_step(kind, f, r), space.labels)
            lines.append((f"{key} -> {name:<3} {label[:30]}", color))
        lines += [("", None),
                  (f"cached {len(renderer.cache)} cells   visited {len(set(path))}", (150, 150, 150)),
                  ("rmb look  home origin  p save  esc quit", (110, 110, 110))]
        for text, color in lines:
            if text:
                screen.blit(font.render(text, True, color), (px, y))
            y += 20
        pygame.display.flip()
        clock.tick(60)

    renderer.running = False
    session.mkdir(parents=True, exist_ok=True)
    (session / "path.json").write_text(json.dumps({**{k: str(v) for k, v in vars(args).items()},
                                                   "path": path}, indent=1))
    print(f"saved flight path to {session / 'path.json'}")
    pygame.quit()


if __name__ == "__main__":
    main()
