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
| `PAYMENT_GATEWAY_BASE_URL` | OnTech payment gateway base (`https://payments.ontech.co.zm/api/v1`). |
| `PAYMENT_GATEWAY_API_KEY` | OnTech API key (`op_…`) for Mobile Money collection. |
| `PAYMENT_GATEWAY_WEBHOOK_SECRET` | Secret used to verify payment webhooks (`/api/payments/webhook`). |
| `PAYMENT_GATEWAY_SIGNING_SECRET` | Optional second signing secret, if the gateway signs with a different key. |
| `STRIPE_SECRET_KEY` | Enables card deposits via Stripe Checkout (`sk_test_…` to try it). Without it, the Card tab is sandboxed with instant credit. |
| `NEXT_PUBLIC_SITE_URL` | Base URL used for Stripe success/cancel redirects. |
| `DATABASE_URL` | Optional Postgres connection — the Drizzle schema in `src/db` is ready for a server-side ledger. |

> 🔑 **Never commit `.env.local`** — it is gitignored. It holds the real gateway/Stripe secrets.

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
| `POST /api/deposit` | Initiates a **Mobile Money deposit** via OnTech: `{ amount, phone }` (Zambian number, e.g. `0976123456`). Returns a `reference` (+ `paymentId`) to poll, or `confirmed: true` for instant/sandbox credit. |
| `GET /api/deposit/status?reference=…&paymentId=…` | Checks the webhook event store, then polls the gateway for payment status. `confirmed: true` → credit the wallet. |
| `POST /api/payments/webhook` | OnTech payment confirmation webhook. Verifies the HMAC signature (secret from env), records the event, answers 200/401. |
| `POST /api/checkout` | Stripe Checkout Session (REST, no SDK) when `STRIPE_SECRET_KEY` is set, otherwise sandbox. |
| `GET /api/checkout/confirm?session_id=…` | Verifies a paid Stripe session and returns the amount to credit. |

## Mobile Money deposit flow

1. Player enters amount + phone number in the **📱 Mobile Money** tab.
2. `POST /api/deposit` calls OnTech `pay/collect` with your `X-API-Key` and records the reference.
3. The player approves the push on their phone.
4. OnTech sends the confirmation webhook → signature verified → event stored.
5. The client polls `GET /api/deposit/status` (every 3s, keeps running if the modal closes) → credits the balance exactly once (double-credit guarded by reference).
6. If the gateway is unconfigured or unreachable, deposits fall back to **sandbox credit** with a clear label (never silently in production — the sandbox only engages when the gateway genuinely can't be reached).

The OnTech response schema isn't publicly documented, so parsing (`src/lib/ontech.ts`) is defensive: it reads status/reference/id from the common field shapes, verifies webhooks against several standard HMAC header conventions, and treats a bare `X-API-Key` header match as a last-resort check. Confirm the exact webhook payload/header with the gateway provider and tighten `verifyWebhookSignature` if needed.

## Accounts: Firebase Auth + Firestore

Players can **sign in / sign up** (email + password or Google) with their balance, bet ledger, money moves and paid-deposit references **synced to Firestore** — they follow the account across devices and tabs (live updates via `onSnapshot`). Guests keep playing with a local wallet and can upload it to their account on sign-in.

- Client setup: `src/lib/firebase.ts` (lazy init — safe under SSR).
- Wallet sync: `src/lib/firestoreWallet.ts` → `users/{uid}/wallet/current` (+ `users/{uid}/payments/{ref}` for deposit idempotency).
- Firestore security rules: **`firestore.rules`** — users can only read/write their own data, and only when authenticated.

### Firebase console setup (one-time)

1. Open the project (`xacheus-339ba`) in [console.firebase.google.com](https://console.firebase.google.com).
2. **Authentication → Sign-in method** → enable **Email/Password** and **Google**.
3. **Authentication → Settings → Authorized domains** → add your Vercel domain(s) (and `localhost` for dev).
4. **Firestore Database → Create database** (production mode is fine — rules below gate access).
5. Deploy rules:
   ```bash
   npm i -g firebase-tools
   firebase login
   firebase use xacheus-339ba
   firebase deploy --only firestore:rules
   ```
6. Optional: set `NEXT_PUBLIC_FIREBASE_*` env vars on Vercel to point at a different project (the app ships with `xacheus-339ba` baked in).

## Deploying to Vercel

1. Push this repo to GitHub and **Import** it in the Vercel dashboard (framework: Next.js — auto-detected; `vercel.json` is included).
2. Add the environment variables (Settings → Environment Variables): `ODDS_API_KEY`, `PAYMENT_GATEWAY_BASE_URL`, `PAYMENT_GATEWAY_API_KEY`, `PAYMENT_GATEWAY_WEBHOOK_SECRET`, optional `STRIPE_SECRET_KEY`. (Firebase vars are optional — defaults are baked in.)
3. Deploy. Then add the production domain to the Firebase **Authorized domains** list.
4. CLI alternative: `npm i -g vercel && vercel` (or `vercel --prod`).

> ⚠️ **Never commit `.env.local`** — it is gitignored. It holds the real gateway/Stripe secrets.

## Production notes

- **Ledger**: guests persist to `localStorage`; signed-in users sync to Firestore (`users/{uid}/wallet/current`) with live multi-device updates. For a real-money deployment, move `src/lib/wallet.ts` operations behind `src/db` and credit deposits server-side (webhook or the confirm route) so the ledger is authoritative on the server.
- **Settlement**: scores are fetched only when you have open bets (request-budget friendly). Auto-settle runs on load and via the **Settle results** button.
- **The Odds API budget**: the free tier allows 500 requests/month; the header shows your remaining calls (`x-requests-remaining`).

---

© 2026 Xacheus Betting · For development & entertainment only · 18+
