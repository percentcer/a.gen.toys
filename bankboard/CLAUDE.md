# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Scope: the bankboard toy. Repo-wide conventions (file:// rule, look, commit
format) are in the root CLAUDE.md — this file covers what's inside
`bankboard/index.html`, which is the entire app.

## Navigating the file

Everything lives in one `<script>` organized by banner comments, in dependency
order: `util` → `csv tokenizer` → `field parsing` → `format sniffing` →
`normalizers` → `store` → `classification` → `transfer pairing` →
`persistence` → `derived model` → `counterfactual replay` → `chart kit` →
one section per card (`net worth`, `decomposition`, `cash flow`, `positions`)
→ `files card` → `transactions table` → `refresh` / `retag` → `demo mode` →
`column mapping` → input wiring → `go`. Search for `// ----------` to jump.

## The data flow (and who invalidates what)

```
CSV text → tokenizeCSV → sniff → normalizer → mergeTxns (dedupe) → state.txns
state.txns + catOf() + pairs → buildModel (memoized on dataVersion)
model + policy → buildCF (memoized on dataVersion + policy fields)
```

- **All mutations funnel through `refresh()`**, which recomputes `pairs`,
  bumps `dataVersion` (invalidating model and counterfactual), re-renders
  everything, and is paired with `saveSoon()` at the mutation site. Never call
  `renderTable()` alone after a change that affects classification — flows,
  pairing, and charts all depend on categories.
- **Category is computed, never stored on a txn.** `catOf(t)` caches per-txn
  against `catVersion`; bump `catVersion` after touching `state.rules` or
  `state.overrides`.
- **`computePairs()` must run before `buildModel()`** (refresh does this) —
  external-flow math treats unpaired internal transfers as money leaving the
  household.

## Invariants that must survive any edit

- **Txn ids are recomputed on load** by replaying the multiset numbering in
  stored order (`deserialize`). Ids are `txnKey(t) + '#' + n`. Changing
  `txnKey`, `TCOLS`, or storage order silently breaks saved
  `overrides` (keyed by id) and cross-session dedupe — if the schema must
  change, bump the storage version and migrate in `deserialize`.
- **Dedupe is multiset, not set**: an incoming file's k copies of a key add
  `max(0, k − stored)` rows, so re-dropping overlapping exports is a no-op
  while genuine same-day duplicate rows survive.
- **Bank anchoring assumes Schwab's row order**: exports are newest-first
  *including within a day*, so the smallest line number among a day's rows
  carries the end-of-day RunningBalance. Synthetic test data must honor this
  or the drift report false-alarms.
- **Counterfactual identity**: with cutoff = today, `buildCF` must reproduce
  `buildModel` exactly (Δ = $0.00). Pre-cutoff, every replay factor is 1 —
  keep the replay's action handling in sync with the model's
  `BUY_RE`/`SELL_RE`/`SHARE_IN_RE` or the identity breaks. This is the
  cheapest regression test; check it after touching either engine.
- **Approximation honesty**: any day valued through interpolated prices sets
  `m.approx[i]` and draws dashed. New valuation paths must keep that flag
  truthful — never present an interpolated number in the exact register.
- **Unknown Schwab actions import as `unknown`**, never rejected — Schwab
  grows its action vocabulary; the FILES card's reject list is only for rows
  that should have parsed.

## Persistence

localStorage keys: `bankboard.v1` (real data), `bankboard.demo` (seeded demo,
smiley button), `bankboard.mode` (which is active). One JSON blob,
column-oriented txns (`TCOLS`), debounced 500 ms, flushed on beforeunload.
The save button exports the same blob as a downloadable backup; dropping it
back restores (via the `backup` file-entry's restore button). Wipe clears only
the active mode's key and must cancel the pending save timer (`resetMemory`).
After browser testing, remove all three keys so the user's origin starts clean.

## Testing

No test framework; verify in the browser (serve repo root, see root CLAUDE.md;
prefer `file_upload` to a real input over synthetic drop events — see the
chrome-extension-flakiness memory).

- **Demo mode is the built-in fixture**: seeded (mulberry32(42)), 4 years,
  two accounts, three symbols, dividends + reinvestment, generated as real
  Schwab-format CSV text and pushed through the normal import pipeline — so it
  exercises the parsers too.
- Cheap correctness probes after a change: re-drop a file → "0 added";
  reload → state identical and rules still apply; NET WORTH note says
  "bank balance matches RunningBalance"; POSITIONS derived qty matches
  reported; counterfactual cutoff = today → difference $0.
- Chart readouts/canvases only update on rAF paints, which don't fire in
  background tabs — synchronous DOM (headlines, notes, status) updates
  immediately; screenshot or foreground the tab before judging chart output.

## Extending

- **New category**: add to `CATS` and a rule in `defaultCat`; decide whether it
  is external (income/spend-like) and update the external-flow test in
  `buildModel` and the replay branch in `buildCF` — a category is not done
  until both engines know which side of the household boundary it's on.
- **New CSV format**: add COLKEYS entries, a signature in `sniff` (order
  matters — most specific first; `prices` is last because it's the loosest),
  and a normalizer returning `{txns|positions, rejects, skipped}`. Tolerate
  drift: match columns by normalized name, scan for the header row, reject
  rows loudly rather than aborting files.
- **New chart**: use `makeChart` (DPR + resize + hover for free) with
  `frameFor`/`paintAxes`/`paintSeries`; series colors are ink/hot/dim only,
  every series direct-labeled or legended — the monochrome palette passes the
  distinguishability checks but only with secondary encoding.
