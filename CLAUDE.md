# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

A collection of small browser toys, one directory per toy (`frequencies/`,
`bankboard/`), with a hand-written landing page at the root `index.html` that
links to each. There is no package.json, no bundler, no test framework, no CI.

## The one hard rule

**Every toy runs straight from `file://`** — a user double-clicks its
`index.html` and it works. This rules out ES modules, CDN scripts, fetching
local data files, and any required server or build step. Each toy is a single
self-contained `index.html` (inline `<style>`, inline `<script>`, inline SVG
icon sprite); binary assets are base64-embedded (see `frequencies/fft_wasm.js`).
Network calls are allowed only for optional extras against CORS-friendly hosts
(frequencies fetches a Wikimedia image), never as a requirement — bankboard
makes none at all.

## Commands

- **Run a toy**: open its `index.html` in a browser. No build needed.
- **Browser automation** (the Chrome extension refuses `file://` URLs): serve
  the repo root with a throwaway static server in the session scratchpad —
  a PowerShell `HttpListener` script on port 8642 is the established pattern —
  then drive `http://127.0.0.1:8642/<toy>/`. Never add the server to the repo.
- **Rebuild frequencies' wasm** (only if `fft.c` changes):
  `frequencies/build.sh`, which needs `zig cc`. This machine has no installed
  compilers — download the portable Zig zip into the scratchpad first.
- **Commits**: message format is `[toyname] lowercase imperative summary`
  (repo-level changes take no prefix). Commit only when the user asks, one
  reviewed change-set per commit.

## Conventions shared by the toys

Copy these from an existing toy rather than inventing variants
(`frequencies/index.html` is the original; `bankboard/index.html` follows it):

- **Look**: light flat palette via CSS custom properties in `:root`
  (`--bg:#e9e9e6 --panel:#fff --edge:#b5b5b0 --ink:#1a1a1a --dim:#6b6b66
  --hot:#a03418`), zero `border-radius` everywhere, no box shadows,
  `system-ui` body text with `ui-monospace` for the brand, panel headings, and
  tabs. Emoji favicon as an SVG data-URI. `--hot` is reserved for destructive
  actions and warnings.
- **Layout**: a `.bar` toolbar (brand + icon-only buttons with lowercase
  em-dash tooltips + right-aligned `#status`), then a `<main>` card grid
  (`repeat(auto-fit, minmax(300px, 1fr))`). Cards are uppercase monospace
  `<h2>` + content + `.toolrow`; per-card view switching uses a right-aligned
  `.tabs` group in the heading. Titles are bare — no tagline after the name;
  explanation lives in tooltips and the help modal.
- **Icons**: inline `<svg><symbol>` sprite of iconmonstr icons referenced with
  `<use href="#i-name">`. iconmonstr has no static URLs; the download recipe is
  in project memory.
- **JS**: `'use strict'` + one top-level IIFE (nothing on `window`),
  `const $ = id => document.getElementById(id)`, section banner comments
  (`// ---------- state ----------`), declarative config objects driving
  generic code (frequencies' `surfaces`, bankboard's classification rules and
  chart configs).
- **Interaction staples**: drag-and-drop-anywhere (`#dropHint` +
  `body.dragging`), hidden `<input type="file">` behind a toolbar button,
  paste support, a `?`-key help modal (`#infoModal`), Esc to close, hover
  popovers via `.pop`. No `alert`/`confirm`/`prompt` — use two-click arming
  for destructive actions (see bankboard's wipe button).
- Each toy ships a short `README.md` (what it is, that it runs client-side,
  notes on the model/math) and gets one `<a>` line in the root `index.html`.

## Toy-specific architecture

- **frequencies**: 2D FFT image editor. C compiled to wasm (`fft.c` →
  `fft.wasm` → base64 in `fft_wasm.js`); JS composes edit layers into
  gain/add/phase maps each frame and the wasm renders. Entirely ephemeral —
  no persistence.
- **bankboard**: personal-finance sandbox fed by Schwab CSV exports (no API).
  Pipeline: RFC4180 tokenizer → format sniffers (brokerage / bank / positions /
  price CSVs / JSON backup, plus a column-mapping rescue dialog) → normalized
  txn log with content-keyed multiset dedupe → rule-based classification with
  user retag rules → derived model (balances anchored to RunningBalance and
  the positions snapshot; trade rows double as price observations, interpolated
  days draw dashed) → hand-rolled canvas charts + a virtualized table →
  counterfactual engine that replays the txn log under a policy (income cutoff,
  spending multiplier, pro-rata scaling, optional auto-liquidation).
  Persistence is localStorage: `bankboard.v1` (real), `bankboard.demo` (seeded
  demo mode, toggled by the smiley button), `bankboard.mode`. When testing,
  wipe these keys afterward so the user's origin starts clean.
