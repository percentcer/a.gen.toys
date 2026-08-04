# vigororb

An appraisal of a Powerball ticket, styled like the websites that sell them.
There is a jackpot size at which a $2 ticket has positive expected value — the
toy computes where that threshold sits once splitting and taxes are priced in,
and shows how far past every drawing in history it lies.

The page reads the live jackpot, cash value, last drawing's winning numbers,
and the next drawing date (with a countdown) from
[powerball.com](https://www.powerball.com/) (via the
[r.jina.ai](https://r.jina.ai) reader proxy, since powerball.com sends no CORS
headers), guesses your state from your IP (ipapi.co, falling back to
California), and lets you override everything: jackpot, state, cash vs.
annuity, Power Play, even the number of tickets in play. If the network is
down it runs from a baked-in snapshot.

## The model

- **Splitting.** Ticket sales are estimated from the advertised jackpot using
  a curve fitted by eye to published per-drawing sales history, and capped
  near 400M tickets past the observed range — the market saturates (the
  January 2016 frenzy peaked around 440M tickets; the record $2.04B drawing
  in November 2022 sold well under 300M). Co-winners are Poisson, so your
  expected share of the jackpot, given that you won, is (1 − e^−λ)/λ with
  λ = tickets ÷ 292,201,338. This is the dominant correction: through the
  observed range, sales grow faster than the jackpot, so each extra
  advertised dollar is increasingly shared.
- **Taxes.** Federal 37% top bracket (a jackpot puts you there; the famous 24%
  is only withholding) plus a built-in table of state rates on lottery
  prizes. California and seven others take nothing; New York takes 10.9%.
  The five states without Powerball are still selectable — you drove across
  the border, but your home state still taxes the income.
- **Cash vs. annuity.** Default is the lump sum, at the live cash/annuity
  ratio. Annuity mode uses the sticker value with no time-discounting —
  that's noted on the page.
- **Small prizes.** All eight fixed tiers, worth about $0.32 gross on a $2
  ticket; only prizes of $5,000+ are taxed. Power Play applies the average
  multiplier and the flat $2M match-5.

Everything is one static `index.html` — no build, no server, runs from
`file://`. Numbers are a toy: tax tables
are approximate top rates, the sales curve is an eyeball fit, and none of it
is financial advice.
