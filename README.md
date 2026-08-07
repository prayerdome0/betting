# 🎰 Xacheus Betting

A full betting-platform front-end: **real sportsbook odds** (via [The Odds API](https://the-odds-api.com)), **8 instant casino games** with synthesized sound effects and heavy animations, a persistent **wallet & bet ledger**, Stripe-ready **deposits**, and a live settlement pipeline — all wrapped in the **Xacheus Betting** brand.

> ⚠️ **Demo platform.** Real-money payouts require a licensed payment processor and compliance with local gambling law (in Zambia: Lotteries and Betting Control Board). The deposit flow is Stripe-ready but defaults to a sandbox mode. 18+ · play responsibly.

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

Open the site, hit the **⚙ Settings** button and paste your [The Odds API key](https://the-odds-api.com) (free tier = 500 requests/month). The Sportsbook immediately switches from clearly-labeled **demo odds** to **real bookmaker odds**. The key never ships in the browser bundle — all calls go through the server proxy at `/api/odds`.

### Environment variables (`.env` — see `.env.example`)

| Variable | Purpose |
| --- | --- |
| `ODDS_API_KEY` | Server-side odds key (production). The in-app Settings panel is the dev/self-hosted alternative. |
| `STRIPE_SECRET_KEY` | Enables real card deposits via Stripe Checkout (`sk_test_…` to try it). Without it, deposits are sandboxed with instant credit. |
| `NEXT_PUBLIC_SITE_URL` | Base URL used for Stripe success/cancel redirects. |
| `DATABASE_URL` | Optional Postgres connection — the Drizzle schema in `src/db` is ready for a server-side ledger. |

## What's inside

- **Sportsbook** — real events & odds (h2h, spreads, totals) from 50+ bookmakers via The Odds API; best-price aggregation; bet slip with live odds; early **cash-out**; one-click **settle results** (auto-settles your open bets when games finish, handles pushes/refunds).
- **Casino** — Coin Flip, Roulette, Dice Roll, Plinko, Lucky Slots, Mines, Sky Crash, Towers. Every round is a real ledger entry.
- **Wallet & ledger** — balance with animated count-up, deposits, withdrawals (requests), bet history with status chips (OPEN / WON / LOST / CASHED).
- **Sound engine** (`src/lib/sound.ts`) — 25+ synthesized Web Audio effects: coin flips, wheel clicks, reel stops, win fanfares, jackpot, explosions, cash-out chimes. No audio files needed. Mutable with the 🔊 toggle (persisted).
- **FX** — confetti bursts, win banners, screen shake on losses, live wins ticker, shimmer buttons, jackpot rays, crash explosion rings, modal/toast animations. Respects `prefers-reduced-motion`.
- **Graceful demo fallback** — missing/invalid key or unreachable odds service ⇒ the site automatically serves realistic demo odds (with a clear banner), so every feature stays testable.

## API routes

| Route | What it does |
| --- | --- |
| `GET /api/odds?action=sports\|odds\|scores&sportKey=…` | Proxies The Odds API v4. Key from `ODDS_API_KEY` env or `x-odds-api-key` header (set by the Settings panel). Falls back to demo data. |
| `POST /api/checkout` | Creates a Stripe Checkout Session (REST, no SDK) when `STRIPE_SECRET_KEY` is set, otherwise returns a sandbox response. |
| `GET /api/checkout/confirm?session_id=…` | Verifies a paid session and returns the amount to credit. |

## Production notes

- **Ledger**: the wallet currently persists to `localStorage` (zero-setup demo). For a real-money deployment, move `src/lib/wallet.ts` operations behind `src/db` and credit deposits server-side (webhook or the confirm route).
- **Settlement**: scores are fetched only when you have open bets (request-budget friendly). Auto-settle runs on load and via the **Settle results** button.
- **The Odds API budget**: the free tier allows 500 requests/month; the header shows your remaining calls (`x-requests-remaining`).

---

© 2026 Xacheus Betting · For development & entertainment only · 18+
