# bankboard

A sandbox for questions about your financial life. Drop CSV exports from
schwab.com — brokerage history, checking history, positions — and get dense
dashboards of your net worth, its decomposition into savings versus market
growth, and counterfactual replays: if I had stopped working two years ago,
how much money would I have today?

Everything runs client-side in one file — just open `index.html`. Data stays
in the browser's localStorage; the page makes no network requests. A demo mode
(smiley button) generates a seeded synthetic history in a separate store.

## Notes on the model

- Bank balances integrate transactions and anchor to the export's own
  RunningBalance column; any drift is reported, never hidden.
- Brokerage holdings come from trade quantities. Prices come from your own
  trades — every buy and sell is a dated price observation — plus the
  positions snapshot and optional per-symbol price CSVs (Yahoo/Nasdaq style,
  named after the symbol). Days valued by interpolation draw dashed.
- Net-worth change over a window = external flows (income − spending)
  + a market-growth residual. Dividends and interest land in the residual.
- The counterfactual is a replay of the same transaction log under a policy:
  income removed after a cutoff, spending scaled, underfunded transfers and
  purchases scaled down pro-rata, dividends following the shares actually
  held, optional pro-rata liquidation to cover overdrafts. Prices are
  unchanged — counterfactual selves don't move markets.
- Re-dropping overlapping exports is safe: rows deduplicate by content, with
  multiset counting so genuine same-day duplicate transactions survive.
