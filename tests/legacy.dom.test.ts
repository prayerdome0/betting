/**
 * The workspace must survive documents that were written by an earlier
 * release, by hand in the Firebase console, or by another application that
 * happens to share the same Firebase project.
 *
 * Reported failure, after signing in:
 *
 *   The workspace hit an unexpected error
 *   Cannot read properties of undefined (reading 'markets')
 *
 * The account document existed in Firestore but carried no `settings` object,
 * so `account?.settings.markets.includes(symbol)` (and the session equivalent)
 * threw while the market table was rendering. The route error boundary then
 * replaced the entire workspace with an apology — the account and the funds
 * were fine the whole time.
 *
 * These cases run the real React tree in jsdom against the fake Firebase
 * transport from `tests/support/dom-flow.ts`. Nothing here asserts that legacy
 * documents are *good*: it asserts that the workspace renders, tells the truth
 * about what it can and cannot show, and never invents money.
 */
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import {
  http,
  installDom,
  resetAuth,
  resetFirestoreData,
  resetHttp,
  rootElement,
  seedPersistedUser,
  setCollection,
  setDocument,
  textContent,
} from "./support/dom-flow";

const EMAIL = "legacy@example.test";
const UID = `uid-${EMAIL.replace(/\W/g, "")}`;
const USER = `users/${UID}`;

const SETTINGS = {
  strategy: "MOMENTUM" as const,
  markets: ["EUR/USD", "GBP/USD", "XAU/USD", "BTC/USD"],
  tradeAmountCents: 200,
  maxPositions: 2,
  stopLossPct: 0.5,
  takeProfitPct: 0.8,
  maxHoldSeconds: 120,
  maxSessionLossPct: 10,
};

function accountFixture(balanceCents = 1000) {
  const now = Date.now();
  return {
    uid: UID,
    email: EMAIL,
    name: "legacy",
    currency: "USD",
    accountType: "SIMULATION",
    status: "ACTIVE",
    balanceCents,
    ledgerSequence: 1,
    activitySequence: 1,
    startingBalanceCents: balanceCents,
    reservedCents: 0,
    withdrawalHoldCents: 0,
    totalPnlCents: 0,
    todayPnlCents: 0,
    pnlDay: new Date(now).toISOString().slice(0, 10),
    trades: 0,
    wins: 0,
    losses: 0,
    settings: SETTINGS,
    activeSessionId: null,
    createdAt: now,
    updatedAt: now,
  };
}

/** The same account as stored by a release that kept settings elsewhere. */
function legacyAccountFixture(balanceCents = 1000) {
  const account: Record<string, unknown> = { ...accountFixture(balanceCents) };
  delete account.settings;
  return account;
}

let root: {
  render: (node: React.ReactNode) => void;
  unmount: () => void;
} | null = null;
let act: (fn: () => unknown | Promise<unknown>) => Promise<void>;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function mount() {
  const [{ createRoot }, app] = await Promise.all([
    import("react-dom/client"),
    import("@/components/TradingApp"),
  ]);
  root = createRoot(rootElement()) as unknown as typeof root;
  await act(async () => {
    root!.render(React.createElement(app.default));
    await wait(20);
  });
  await act(async () => wait(20));
}

/** Server that answers commands without ever writing an account document. */
function stubBackend(message = "Account is ready.") {
  http.command = async () => ({ status: 200, body: { message } });
}

function initializeCalls() {
  return http.requests.filter(
    (request) =>
      request.path === "/api/command" &&
      (request.body as { action?: string })?.action === "initialize",
  ).length;
}

beforeEach(async () => {
  installDom();
  resetAuth();
  resetFirestoreData();
  resetHttp();
  stubBackend();
  const react = await import("react");
  act = react.act as unknown as typeof act;
});

afterEach(async () => {
  if (root) {
    await act(async () => root!.unmount());
    root = null;
  }
});

test("an account stored without settings renders instead of crashing the workspace", async () => {
  seedPersistedUser(EMAIL);
  setDocument(USER, legacyAccountFixture());
  await mount();
  await act(async () => wait(40));

  const text = textContent();
  assert.doesNotMatch(text, /unexpected error/);
  assert.doesNotMatch(text, /reading 'markets'|reading "markets"/);
  assert.match(text, /Trading overview/, "the workspace is rendered");
  assert.match(text, /\$10\.00/, "the stored balance is displayed");
  assert.ok(
    initializeCalls() > 0,
    "the client still asks the server to initialize/heal the account",
  );
});

test("a session snapshot without settings cannot crash the market watch", async () => {
  seedPersistedUser(EMAIL);
  setDocument(USER, accountFixture());
  await mount();
  await act(async () => wait(20));
  assert.match(textContent(), /Trading overview/);

  // Deliver the legacy session *after* the first render, so Firestore reports a
  // live (non-cached) snapshot: the market watch then evaluates the active
  // session's selected markets, which is where the reported crash happened.
  const legacySession: Record<string, unknown> = {
    id: "s-legacy",
    userId: UID,
    startedAt: Date.now() - 60000,
    expiresAt: Date.now() + 60000,
    durationSeconds: 120,
    status: "ACTIVE",
    aiStatus: "SCANNING",
    settings: SETTINGS,
    strategy: "MOMENTUM",
    startingBalanceCents: 1000,
    endingBalanceCents: null,
    totalPnlCents: 0,
    tradesGenerated: 0,
    completedAt: null,
    lastTickAt: 0,
    stopReason: null,
  };
  delete legacySession.settings;
  setCollection(`${USER}/tradingSessions`, [legacySession]);
  setDocument(USER, { ...accountFixture(), activeSessionId: "s-legacy" });
  await act(async () => wait(40));

  const text = textContent();
  assert.doesNotMatch(text, /unexpected error/);
  assert.match(text, /Market watch/);
  assert.match(
    text,
    /Firestore connected/,
    "the live snapshot was applied, so the active-session market path ran",
  );
});

test("a document that is not this application's account is reported, not rendered", async () => {
  seedPersistedUser(EMAIL);
  setDocument(USER, { plan: "premium", wellnessScore: 42 });
  await mount();
  await act(async () => wait(40));

  const text = textContent();
  assert.doesNotMatch(text, /unexpected error/);
  assert.match(text, /Trading overview/, "the workspace keeps rendering");
  assert.match(
    text,
    /not a Nexus simulation account/i,
    `the real reason is displayed:\n${text.slice(0, 600)}`,
  );
  assert.doesNotMatch(
    text,
    /\$\d/,
    "no balance is invented for a document that has none",
  );
  assert.match(text, /SIMULATION MODE/);
});

test("trades and activity records without financial fields are skipped, not rendered", async () => {
  seedPersistedUser(EMAIL);
  setDocument(USER, accountFixture(50000));
  const now = Date.now();
  const goodTrade = {
    id: "t1",
    userId: UID,
    sessionId: "s1",
    market: "EUR/USD",
    side: "BUY",
    amountCents: 10000,
    entryPrice: 1.08,
    currentPrice: 1.08,
    exitPrice: null,
    quantity: 92.59,
    stopLoss: 1.07,
    takeProfit: 1.1,
    startedAt: now,
    endedAt: null,
    pnlCents: 0,
    feesCents: 0,
    status: "OPEN",
    result: null,
    strategyVersion: "rules-v1.0",
    aiDecision: "BUY",
    reason: "Momentum",
    closeReason: null,
    source: "SYNTHETIC",
  };
  setCollection(`${USER}/trades`, [
    goodTrade,
    { id: "t2", market: "EUR/USD", side: "BUY", status: "CLOSED" },
  ]);
  setCollection(`${USER}/activity`, [
    {
      id: "a1",
      sequence: 1,
      userId: UID,
      sessionId: null,
      timestamp: now,
      kind: "ACCOUNT",
      message: "Account created.",
    },
    { id: "a2", sequence: 2 },
  ]);
  setCollection(`${USER}/ledger`, [
    {
      id: "l1",
      type: "WELCOME_CREDIT",
      deltaCents: 50000,
      balanceAfterCents: 50000,
    },
  ]);
  await mount();
  await act(async () => wait(40));

  const text = textContent();
  assert.doesNotMatch(text, /unexpected error/);
  assert.match(text, /\$500\.00/, "the good records are still shown");
  assert.doesNotMatch(text, /undefined/);
});

test("a repaired account document is reported through the server message", async () => {
  seedPersistedUser(EMAIL);
  setDocument(USER, legacyAccountFixture());
  stubBackend(
    "Account is ready. Trading preferences were missing from this account and documented defaults were restored. Review them in Settings.",
  );
  await mount();
  await act(async () => wait(40));

  assert.match(
    textContent(),
    /documented defaults were restored/,
    "the repair is surfaced instead of silently rewriting preferences",
  );
});
