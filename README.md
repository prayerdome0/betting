# NEXUS AI — persistent trading simulation

A responsive Next.js trading workspace backed by **Firebase Authentication and Firestore**, with an **independent, server-authoritative paper-trading worker**. Light/dark themes, automated sessions, timestamp-based countdowns, strategy settings, trade inspection/CSV export, balance charts, a persistent activity timeline, simulated withdrawals, and a claims-protected admin inspector.

**Simulation only. No real money, no broker orders, no live prices, no guaranteed profits.** The “AI” is a transparent rules-based momentum / mean-reversion engine, not an LLM or a claimed predictive model. The initial feed is explicitly synthetic. There is no code path that submits real orders or payments.

## Current deployment status

The provided public client configuration for **`ai-health-d2c5b`** is wired in as the default for every `NEXT_PUBLIC_FIREBASE_*` variable. Public Firebase config is not a server credential. This checkout does **not** contain an Admin key, does not deploy rules automatically, and cannot turn on Firebase services on your behalf.

**Pointing the site at a different Firebase project** (for example the project your existing users already live in) means setting *all* of `NEXT_PUBLIC_FIREBASE_API_KEY`, `_AUTH_DOMAIN`, `_PROJECT_ID`, `_APP_ID`, `_MESSAGING_SENDER_ID`, `_STORAGE_BUCKET` **and** the server-side `FIREBASE_PROJECT_ID` plus a service account from that same project. A partial switch leaves the browser signing users into one project while the server verifies tokens against another; every authenticated request then fails and new accounts can never be created. The server refuses that combination explicitly (`PROJECT_MISMATCH` in `GET /api/health`) instead of failing silently.

**Until you complete the Firebase setup below and run the worker, accounts cannot initialize in Firestore and new trading sessions are blocked.** The UI surfaces connection/setup errors; it never falls back to fake balances, seeded trades, or browser-only account storage. A signed-out dashboard deliberately shows empty data rather than an invented $500 portfolio.

## 1. Production Firebase setup

1. In Firebase Console → `ai-health-d2c5b`, enable **Authentication → Email/Password**. Configure a suitable password policy and email enumeration protection. Add the deployed website domain (and development preview domain if needed) to Auth authorized domains. Configure password-reset templates and authorized action URLs.
2. Create a **Cloud Firestore** database in the desired region. Confirm billing, budgets, and access policies.
3. Install dependencies with Node **22+**: `npm ci`.
4. Copy `.env.example` to `.env.local`. Its default public config already points to the supplied project.
5. Give the **server** a Firebase identity, independently for the web server and the worker. This is mandatory: the Firestore rules deny every client write, so the account document created immediately after sign-up can only be written server-side. Pick one:
   - **Serverless / Vercel (recommended there):** create a service account key (Firebase console → Project settings → Service accounts → Generate new private key) and set it as `FIREBASE_SERVICE_ACCOUNT_JSON` (the whole JSON file in one variable), or split it into `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY` (+ optional `FIREBASE_PRIVATE_KEY_ID`). PEM newlines may stay as literal `\n`; they are normalized. Give that account only Firestore data access and Firebase Auth token verification.
   - **GCP / Cloud Run / VM:** an attached Google Cloud service identity via Workload Identity Federation or Application Default Credentials.
   - **Local alternative:** `GOOGLE_APPLICATION_CREDENTIALS=/secure/external/path/credential.json`. Keep that file outside the checkout. Never paste credentials into chat, expose them through `NEXT_PUBLIC_*`, or ship them in a client or Android bundle.
   `FIREBASE_PROJECT_ID` must match `NEXT_PUBLIC_FIREBASE_PROJECT_ID` (and the service account's `project_id`). A mismatch is rejected at startup with an explicit `PROJECT_MISMATCH` diagnostic, because ID tokens can only be verified inside the project that issued them.

   Verify at any time with `GET /api/health` (or `npm run doctor -- --json`): `checks.identity` must be `true`, and `identitySource` tells you which credential mechanism is in use.
6. Deploy rules and indexes with an authorized Firebase CLI identity:
   ```bash
   npx firebase deploy --only firestore:rules,firestore:indexes --project ai-health-d2c5b
   ```
   Do not test this app against permissive legacy wallet rules. All client writes to financial and account documents are intentionally denied.
7. Start **both** services:
   ```bash
   # Web (terminal/service 1)
   npm run dev -- --hostname 0.0.0.0

   # Independent worker (terminal/service 2; loads .env.local)
   npm run worker
   ```
   Production web: `npm run build && npm run start -- --hostname 0.0.0.0`.
8. Create a user through the UI. The server initializes the $10 welcome account once in a Firestore transaction. Configure $500 (or another virtual balance) explicitly in Settings.
9. For authorized admin inspection, run this **trusted operator-only** command:
   ```bash
   npm run admin:grant -- FIREBASE_AUTH_UID
   # Revoke:
   npm run admin:grant -- FIREBASE_AUTH_UID revoke
   ```
   Sign out/in to refresh the custom claim. Admin authorization is `request.auth.token.admin === true`; it is never inferred from a client profile field or an email address.

### Deploying to Vercel

`vercel.json` only declares the framework; the runtime configuration lives in Vercel → Settings → Environment Variables:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` / `_AUTH_DOMAIN` / `_PROJECT_ID` | your Firebase web app config (public) |
| `NEXT_PUBLIC_FIREBASE_APP_ID` / `_MESSAGING_SENDER_ID` / `_STORAGE_BUCKET` | use all values from `.env.example` together with the project id |
| `FIREBASE_PROJECT_ID` | same project as the browser config |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | the full replacement service account key file (server-only; mark sensitive in Vercel) |

`.env.example` contains the complete public configuration for `ai-health-d2c5b`. Copying it to `.env.local` configures local runs only; it does **not** set Vercel environment variables. Enter the values in Vercel for each intended deployment environment. Never reuse a service-account key shared in chat: revoke it in Google Cloud IAM and enter a replacement directly in Vercel, not in source control. Configure the worker's credential separately on its host.

The supplied public Web Push key is recorded as `NEXT_PUBLIC_FIREBASE_VAPID_KEY` in `.env.example` for future use. It is not an Admin credential, and push notifications are **not enabled**: messaging service-worker support, token registration, and a notification sender are not yet implemented.

After redeploying, open `/api/health`. Both `checks.identity` and `checks.database` must be `true` to confirm backend access. `WORKER_OFFLINE` means Firebase is reachable but the separate worker is not running; full readiness requires all four checks to pass. For a local read-only check, use `npm run doctor -- --json`.

Redeploy after changing them (`NEXT_PUBLIC_*` values are inlined at build time). Then in Firebase console → Authentication → Settings → **Authorized domains**, add your production domain and every preview domain you intend to use; otherwise sign-in is rejected with `auth/unauthorized-domain`.

The **worker cannot run on Vercel** (it is a request-only platform). Host `npm run worker` on an always-on VM/container — see below. Until it runs, accounts initialize normally but starting a session is blocked with "The trading worker is offline".

### Sign-in troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| Sign-up succeeds, dashboard stays on "Connecting your persistent account" | `/api/command` cannot act as a trusted server. Read the banner text: `NOT_CONFIGURED` means no server credential, `PROJECT_MISMATCH` means browser and server point at different Firebase projects, `CREDENTIAL_REJECTED` means Google refused the key. `GET /api/health` returns the same diagnostics as JSON. |
| `auth/unauthorized-domain` / `auth/admin-restricted-operation` | Firebase console → Authentication: enable Email/Password and add the site domain to Authorized domains. |
| Browser-level "This page couldn't load" on a `*.vercel.app` **preview** URL | Vercel Deployment Protection (Standard Protection) gates preview deployments behind a Vercel login. Use the production domain, or turn protection off for that deployment. |
| Blank page after an unexpected client error | Should no longer happen: `src/app/error.tsx` and `src/app/global-error.tsx` render a recoverable message with the error and a reload action. |

### Hosting the worker is mandatory

A website deployment alone is insufficient. `scripts/worker.ts` must run continuously on an always-on VM, a supervised container, or a worker service. Run under a process supervisor with automatic restart. Do **not** put the loop in a short-lived Vercel function, a browser tab, or a request handler. The provided Dockerfile builds a web image; run a second instance of the image with `npm run worker`. On managed platforms, use a workload intended for always-on workers, not a request-only container that pauses CPU between requests.

The worker persists a heartbeat, polls a Firestore work queue, advances a shared synthetic feed, and processes sessions every five seconds. Start/resume require a recent worker heartbeat. Stale quotes never execute. Multiple workers are protected by per-session quote deduplication and optimistic Firestore transactions; this is a modest-scale prototype, not a low-latency exchange.

If **the browser closes**, the worker continues. If **the worker/server itself is down**, no trades or historical prices are invented: on restart, expiry is checked against the original deadline and positions are settled using the next available quote. An interruption is recorded. Stop requests persist immediately and block new entries; if the worker is down, settlement waits for it to return.

## 2. Fully isolated local Firebase development

Requires Java **21+** for the official Firestore emulator and network access for its initial download. Do not point emulator mode at the production project.

Use these values together in `.env.local`:

```dotenv
NEXT_PUBLIC_FIREBASE_EMULATORS=true
FIREBASE_PROJECT_ID=demo-nexus
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
```

Run in separate terminals:

```bash
npm run emulators
npm run dev -- --hostname 0.0.0.0
npm run worker
```

The browser uses **same-origin rewrites** for Auth and Firestore emulator traffic; no browser-facing `localhost` service URLs are used. The UI labels emulator mode explicitly. Do not expose emulator-mode deployments to untrusted users: emulators have no production IAM security boundary. Production never enables these rewrites.

`npm run emulators` imports `.firebase-data` and exports on graceful exit, so local account data survives a normal emulator restart. Browser reload/close never resets data. A forced emulator crash may lose data since its last export; use production Firestore for durable hosted persistence. Emulator files are ignored by Git. Emulator password-reset links appear in the emulator logs; no email is sent.

## Architecture

```text
MarketDataProvider (SyntheticMarketProvider today; licensed adapter later)
        ↓
Rules-based strategy / auditable analysis (momentum or mean reversion)
        ↓
Risk checks (allocation, reserved funds, position cap, session loss limit)
        ↓
PaperExecution adapter (no leverage; collateral-limited loss)
        ↓
Firestore transaction: position/trade + account + ledger + session + events
        ↓
Firestore onSnapshot listeners → dashboard
```

- UI: `src/components/`, `src/lib/useTrading.ts` (reads and authenticated command requests only).
- Market provider: `src/lib/server/market.ts`.
- Pure strategies and financial math: `src/lib/trading/strategy.ts`.
- Authoritative execution: `src/lib/server/engine.ts`, `scripts/worker.ts`.
- Commands, validation, one-time initialization: `src/lib/server/commands.ts`, `validation.ts`.
- Authenticated API: `src/app/api/command/route.ts`; admin API: `src/app/api/admin/route.ts`.
- Security: `firestore.rules`; Admin SDK initialization is server-only, never imported into the client bundle. Server identity resolution and the browser/server project agreement check live in `src/lib/server/firebase.ts` + `src/lib/firebaseProject.ts`.
- Resilience: `src/app/error.tsx` and `src/app/global-error.tsx` keep an unexpected client exception from turning into a dead page; `useAuth` reports auth/config failures instead of hanging, and `useTrading` retries the one-time account bootstrap with a bounded backoff.

### Data model

```text
users/{uid}                           # Profile, currency, account type/status,
                                      # authoritative cents, stats, settings, current session ID
users/{uid}/settings/profile
users/{uid}/settings/trading
users/{uid}/portfolio/current         # Transactionally updated balance/available projection
users/{uid}/tradingSessions/{id}       # Deadline, snapshot of strategy, start/end state, results
users/{uid}/trades/{id}                # OPEN → CLOSED, prices, side, quantity, net P/L,
                                      # fees, timestamps, decision/reason/version, session ID
users/{uid}/ledger/{id}               # Every balance delta, resulting balance, reference
users/{uid}/activity/{id}             # Timestamped scans, analyses, waits, signals, monitoring
users/{uid}/withdrawals/{id}          # Simulated request workflow, held funds
users/{uid}/commands/{key}            # Server-only idempotency receipts
workQueue/{uid}                       # Server-only active-session work pointer
system/market                        # Shared, explicitly synthetic market feed
system/worker                        # Heartbeat and operational status
systemEvents/{id}                    # Admin-only errors and workflow audit
```

Timestamps are server-generated **Unix milliseconds** (not client clocks). Transaction callbacks reevaluate the server clock on retry, so contention cannot preserve an obsolete deadline or authorize stale quotes. Money uses integer cents. Per-account monotonic sequences order ledger entries and activity even when several events share the same millisecond. Account creation is transactional: racing first logins cannot issue two welcome credits. Profile, portfolio, settings projections and balance ledger commit together. No account data is stored only in React or localStorage; localStorage contains only the visual theme. Firebase Auth uses its supported local persistence, not hand-written password storage.

### Financial semantics

- Initial starting/welcome balance is **$10.00**, currency USD, account type SIMULATION.
- Configure funds explicitly in Settings. This writes a `DEMO_ADJUSTMENT` delta, never deletes history, and is blocked while a session or withdrawal hold exists. No auto-$500 reset.
- Position allocation is reserved, not debited. Available balance = balance − open allocations − withdrawal holds. P/L is realized only when a position closes.
- One position per selected market; no more than configured maximum; each allocation ≤25% of current balance. No leverage.
- BUY net P/L in cents = `round(amountCents × (exit / entry − 1)) − round(amountCents × 2 / 10000)`.
- SELL uses the negative of that price return before the same fees. Total fee is **2 bps round trip**, rounded once to cents. A position can lose at most its fully allocated collateral.
- Stop/target/max-hold checks execute at the next observed quote. Gaps/slippage relative to the trigger are reflected in the result, not magically filled at a better price. Fees can make a flat trade a loss. Small allocations may produce zero-cent results due to currency rounding.
- Account and session win/loss statistics come from real simulated settlements. Break-even is not a win or loss. Win rate divides wins by all closed trades.
- “Today” is UTC realized P/L; current P/L is net unrealized P/L. No arbitrary win-rate target, seeded results, or positive drift is used.
- Session starting/ending balances are actual account snapshots; session P/L includes **only its trade results**. Other ledger transactions (e.g. a simulated withdrawal) can make balance difference unequal to trade P/L.

### Session semantics

Presets: 5/10/30 minutes, 1/2/3/5/10/24 hours; custom 1–10,080 minutes; unlimited. Settings are snapshotted at start. Editing preferences applies to the **next** session, not existing positions.

```text
ACTIVE ↔ PAUSED
ACTIVE / PAUSED → STOPPING → STOPPED
ACTIVE / PAUSED → COMPLETED (deadline; positions settled first)
```

Pause stops entries but continues managing positions and **does not extend expiry**. Resume only works before the original deadline. Stop immediately blocks entries; the worker closes positions at its next quote and records ending balance/completion time. Unlimited has no expiration, but manual stop and risk controls still apply. Session loss control evaluates the entire marked-to-market book and projected realized exits before settlement. If the limit is breached, all positions close at the same observed quote rather than depending on query order. Market gaps and observation latency can exceed the configured loss threshold. It is a safety stop, not an exact guaranteed maximum loss.

### Withdrawals and admin

Requests are **simulated and do not transfer real funds**. Submission places a hold, not a balance debit. Cancellation releases the hold. Authorized admin workflow is `Submitted → Under Review → Simulated Completed` (or cancellation), where a simulated completion debits the virtual balance and creates a ledger entry. Finalized requests cannot be processed twice.

Users see their own requests and can cancel unfinalized ones. Admins can page through registered users and inspect sessions, balances, trades, P/L, logs, and ledger entries. The admin API has **no trade-result or direct balance mutation endpoint**. Request workflow changes generate admin audit events. Firestore rules also deny all direct client writes, including admins.

Infrastructure owners with Google Cloud Admin permissions necessarily bypass application rules. For a tamper-resistant production audit, separate deployment/IAM privileges, enable Cloud Audit Logs, and export an immutable audit stream; this prototype does not pretend to make a project owner powerless.

### Future live trading

Keep live execution in a **separate, authorized service/account namespace and credentials boundary**, implementing its own broker adapter and compliance requirements. Do not change a frontend “mode” flag to point simulated positions at a broker. The current `ExecutionAdapter` accepts only `environment: 'SIMULATION'`; there is no installed live implementation. A real market-data adapter can be added without adding live order capability.

## Tests and checks

```bash
npm run typecheck
npm run lint
npm test                         # Math + server transaction contracts (test double, not Firebase)
npm run build
npm run doctor -- --json          # Read-only server/Firestore/worker/feed readiness

# With official Firebase emulators already running:
FIREBASE_PROJECT_ID=demo-nexus FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
  FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 npm run test:integration

# Web server running on port 3000:
npx playwright install --with-deps chromium
npm run test:e2e                  # Desktop/mobile interactions and API access checks
# Additionally enable account + browser-close trading workflow:
E2E_FIREBASE_EMULATORS=true npm run test:e2e
```

Unit tests include an explicitly isolated transaction test double in `tests/support/`. It exercises server commands, execution, rollback/retry behavior, idempotency, account separation, deadline reevaluation, whole-book safety, withdrawals, and ledger reconciliation. It is **never used by the running app or worker**, and does not verify Firestore rules, actual network concurrency, indexes, or Firebase Auth.

Integration tests use transactions against the **official Firestore emulator** and test isolation/rules with `@firebase/rules-unit-testing`. They cover concurrent one-time credit, duplicate commands, duplicate worker ticks, ledger reconciliation, winners and losers, pause/resume deadline preservation, expiry/stop settlement, unlimited sessions, and repeated withdrawal cancellation. They are explicitly skipped without emulator configuration. Never run test fixtures against production.

An **inactive GitHub Actions template** is provided at `docs/ci/verify.yml.example`. It installs Java and the official emulators, runs integration/rules tests, builds the web app, starts its independent worker, and runs the authenticated browser-close/reopen flow. It is intentionally outside `.github/workflows` because the GitHub connection used to submit this PR does not have workflow-write permission. **CI will not run automatically from this template.** An authorized maintainer can enable it by copying the file to `.github/workflows/verify.yml` and committing that change. The workflow has not been run remotely by this session.

### Verification in the build environment

- TypeScript, ESLint, production build and 65 unit tests pass.
- **The client authentication flow is covered end to end** by a jsdom harness (`tests/authflow.dom.test.ts`, support in `tests/support/dom-flow.ts`) that renders the *real* components against a fake Firebase Auth/Firestore transport: registration → account creation → dashboard, sign-in, reload with a persisted session, sign-out → sign-in again, an auth failure inside the dialog, denied Firestore reads, and a 503/HTML/object-shaped `/api/command` failure — the exact conditions that used to strand a new user after sign-up.
- **Server identity resolution is covered** by `tests/identity.test.ts`: service-account JSON in one env var, split fields, literal `\n` PEM escaping, malformed JSON, project mismatch (credential vs. `FIREBASE_PROJECT_ID` vs. `NEXT_PUBLIC_FIREBASE_PROJECT_ID`), emulator isolation, and the guarantee that a missing server credential produces a 503 about the server rather than a 401 blaming the user.
- Desktop/mobile interaction, readiness/offline-state, and unauthenticated API access checks pass (6 browser tests).
- **Firebase-backed integration/account tests were not executed here**: no server identity is configured, Java is unavailable, and this sandbox cannot download the official emulator binaries. These limitations are not replaced by a fake backend.

## Diagnostics and failure behavior

- **Settings → System connection** displays server identity, Firestore reachability, independent worker heartbeat, and quote freshness. These are observed readiness checks, not decorative indicators. They do not prove that Auth providers or deployed rules are configured correctly; run integration tests for those.
- `npm run doctor` (or `npm run doctor -- --json`) performs the same read-only readiness check. It exits nonzero when a required service is unavailable and never creates an account or changes funds. No Admin credentials are printed.
- Offline/cached account snapshots are explicitly marked. Offline clients cannot submit commands; an existing session can still run on the remote worker.
- Invalid/non-finite quotes, inconsistent reserved funds, cross-session positions, and unsafe monetary values fail closed. They do not trigger a browser balance reset or a guessed trade result.
- Worker session failures appear on the affected session and in admin events. Repeated identical blocked intervals are deduplicated; successful execution clears the error and records recovery. Stop requests can still be submitted while connected, but safe settlement requires valid server state and fresh quotes.
- Idempotency receipts are bound to a canonical command fingerprint. Reusing one key for a different payload returns a conflict instead of silently accepting the wrong command.

## Operational scope and limits

- This is a functioning code prototype, **not a production financial service**. Real Firebase deployment and worker hosting remain operator setup tasks.
- Rate-limit authenticated API requests at the gateway and consider Firebase App Check before public exposure. Set Firebase budget alerts. Scanning/monitoring logs every five seconds can be expensive; define a retention/export policy before scale.
- Owner views subscribe to latest 100 sessions/events/ledger entries/requests, latest 50 trades with older-trade pagination, and every open position. All records remain persisted. CSV exports the currently loaded, filtered trades; it does not falsely claim to include unloaded history. Admin record inspection is paginated.
- Recorded prices are synthetic and their chart shows the latest 120 observations, not a fabricated 24-hour market chart. Balance charts show the latest 100 ledger entries and include explicit fund adjustments.
- State is server-authoritative; offline/stale data must not be treated as current execution. The app never executes trades offline in a browser.
- Secrets should be managed by hosting identity/secrets infrastructure. Use fictional payment details in the prototype, not sensitive customer account information.
- The old betting, real-payment/deposit endpoints, fake seeded history and in-memory simulation APIs were removed rather than left alongside this isolated simulator.
