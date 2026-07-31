# Frequencies

A frequency-domain graffiti / steganography toy. Drop an image in, see its 2D FFT
(per-RGB-channel log-magnitude + phase, fftshifted), then paint on the spectrum
*spatially* — attenuate, boost, brush, text, or emoji stamps — and watch the live
inverse FFT rebuild the image. A `difference` view with adjustable gain makes
frequency-domain watermarks visible.

Everything runs client-side. The FFT core is C compiled to WebAssembly
(`fft.c` → `fft.wasm`), embedded as base64 in `fft_wasm.js` so the page works
straight from `file://` — just open `index.html`.

## Building the wasm core

Only needed if you change `fft.c`. Requires [Zig](https://ziglang.org/download/)
(the portable zip works, no install):

```sh
ZIG=/path/to/zig ./build.sh
```

## Notes on the math

- Radix-2 iterative Cooley–Tukey, rows then columns, per RGB channel.
- Compiled freestanding (no libm): FFT twiddles are precomputed in JS; the C side
  uses small polynomial approximations for sin/cos/ln/atan2 (display + phase paint).
- Edits are maps in shifted display coordinates: a magnitude gain map, an additive
  magnitude map, and a phase-rotation map. Only the real part of the inverse FFT is
  kept, which implicitly Hermitian-symmetrizes whatever you paint — the optional
  "conjugate mirror" brush just makes that symmetry visible while you draw.
