/**
 * The Firestore read boundary (`src/lib/trading/documents.ts`) is what stands
 * between a stored document and the rendered workspace. These tests pin the two
 * guarantees it makes:
 *
 *   1. a document can never crash a render — missing fields come back as
 *      documented defaults, and
 *   2. a document is never made up — money, positions and prices that were not
 *      stored are reported as `null` instead of as a plausible number.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SETTINGS_BOUNDS,
  readAccount,
  readActivity,
  readCollection,
  readFeed,
  readLedgerEntry,
  readSettings,
  readSession,
  readTrade,
  readWithdrawal,
} from "../src/lib/trading/documents";
import { DEFAULT_SETTINGS, type Settings } from "../src/lib/trading/types";
import { settingsSchema } from "../src/lib/server/validation";

const SETTINGS: Settings = {
  ...DEFAULT_SETTINGS,
  markets: ["EUR/USD"],
  tradeAmountCents: 10000,
  maxPositions: 1,
};

function accountRow(extra: Record<string, unknown> = {}) {
  return {
    uid: "someone-else",
    email: "legacy@example.test",
    name: "Legacy",
    currency: "USD",
    accountType: "SIMULATION",
    status: "ACTIVE",
    balanceCents: 50000,
    ledgerSequence: 2,
    activitySequence: 3,
    startingBalanceCents: 1000,
    reservedCents: 0,
    withdrawalHoldCents: 0,
    totalPnlCents: -250,
    todayPnlCents: -250,
    pnlDay: "2026-09-21",
    trades: 1,
    wins: 0,
    losses: 1,
    settings: SETTINGS,
    activeSessionId: null,
    createdAt: 1,
    updatedAt: 2,
    ...extra,
  };
}

test("a missing settings object is filled from documented defaults, nothing else changes", () => {
  const { settings, ...withoutSettings } = accountRow();
  assert.deepEqual(settings, SETTINGS);
  const account = readAccount(withoutSettings, "uid-1");
  assert.ok(account);
  assert.deepEqual(account.settings, DEFAULT_SETTINGS);
  assert.equal(account.balanceCents, 50000, "money is read, never derived");
  assert.equal(account.totalPnlCents, -250);
  assert.equal(account.uid, "uid-1", "the document path identifies the owner");
  assert.equal(account.activeSessionId, null);
});

test("unusable settings fields are replaced individually and the rest are preserved", () => {
  const account = readAccount(
    accountRow({
      settings: {
        ...SETTINGS,
        strategy: "TURBO_MODE",
        markets: ["EUR/USD", "DOGE/USD", "EUR/USD"],
        tradeAmountCents: Number.NaN,
        maxPositions: 99,
        stopLossPct: "0.5",
        maxHoldSeconds: 120,
      },
    }),
    "uid-1",
  );
  assert.ok(account);
  assert.deepEqual(account.settings, {
    ...DEFAULT_SETTINGS,
    markets: ["EUR/USD"],
    maxHoldSeconds: 120,
  });
});

test("reading never mutates the documented defaults or the stored row", () => {
  const before = structuredClone(DEFAULT_SETTINGS);
  const row = accountRow();
  const snapshot = structuredClone(row);
  const account = readAccount({ ...row, settings: undefined }, "uid-1");
  assert.ok(account);
  account!.settings.markets.push("BTC/USD");
  assert.deepEqual(DEFAULT_SETTINGS, before, "defaults stay immutable");
  assert.deepEqual(row, snapshot, "the stored row is not rewritten");
});

test("a document that is not this application's account is rejected, not rendered", () => {
  assert.equal(readAccount({ plan: "premium" }, "uid-1"), null);
  assert.equal(
    readAccount(accountRow({ accountType: "LIVE_BROKER" }), "uid-1"),
    null,
  );
  assert.equal(readAccount(accountRow({ currency: "EUR" }), "uid-1"), null);
  assert.equal(readAccount(accountRow({ status: "SUSPENDED" }), "uid-1"), null);
  // A balance the document does not contain is never invented.
  const { balanceCents, ...noBalance } = accountRow();
  assert.equal(balanceCents, 50000);
  assert.equal(readAccount(noBalance, "uid-1"), null);
  assert.equal(readAccount(accountRow({ balanceCents: 12.5 }), "uid-1"), null);
  assert.equal(readAccount(null, "uid-1"), null);
  assert.equal(readAccount("users/uid-1", "uid-1"), null);
});

test("account counters and P/L fall back to zero, never to a fabricated win or loss", () => {
  const account = readAccount(
    accountRow({
      trades: undefined,
      wins: undefined,
      losses: undefined,
      pnlDay: undefined,
    }),
    "uid-1",
  );
  assert.ok(account);
  assert.equal(account.trades, 0);
  assert.equal(account.wins, 0);
  assert.equal(account.losses, 0);
  assert.notEqual(account.pnlDay, new Date().toISOString().slice(0, 10));
});

test("a session without a settings snapshot still renders with usable defaults", () => {
  const session = readSession(
    {
      id: "s1",
      userId: "uid-1",
      startedAt: 1000,
      status: "ACTIVE",
      strategy: "MEAN_REVERSION",
    },
    "doc-id",
  );
  assert.ok(session);
  assert.deepEqual(session.settings, DEFAULT_SETTINGS);
  assert.equal(session.strategy, "MEAN_REVERSION", "recorded values win");
  assert.equal(
    session.durationSeconds,
    null,
    "no duration stored means unlimited",
  );
  assert.equal(session.expiresAt, null);
  assert.equal(session.aiStatus, "SCANNING");
  const bounded = readSession({
    id: "s2",
    startedAt: 1000,
    durationSeconds: 120,
    status: "COMPLETED",
    settings: SETTINGS,
  });
  assert.equal(
    bounded?.expiresAt,
    121000,
    "a bounded deadline is derived exactly as the session invariant defines it",
  );
  assert.equal(
    readSession({ status: "ACTIVE" }),
    null,
    "no identity, no session",
  );
  assert.equal(
    readSession({ id: "s1", status: "RUNNING", startedAt: 1 }),
    null,
  );
});

test("a trade without its entry price or allocation is dropped instead of shown", () => {
  const trade = {
    id: "t1",
    userId: "uid-1",
    sessionId: "s1",
    market: "EUR/USD",
    side: "BUY",
    amountCents: 10000,
    entryPrice: 1.25,
    startedAt: 1,
    status: "OPEN",
  };
  const read = readTrade(trade);
  assert.ok(read);
  assert.equal(
    read.quantity,
    10000 / 100 / 1.25,
    "quantity is derived exactly, not guessed",
  );
  assert.equal(read.stopLoss, 0, "an unrecorded level is not invented");
  assert.equal(read.currentPrice, 1.25);
  assert.equal(read.source, "SYNTHETIC");
  assert.equal(readTrade({ ...trade, entryPrice: undefined }), null);
  assert.equal(readTrade({ ...trade, amountCents: 0 }), null);
  assert.equal(readTrade({ ...trade, market: "DOGE/USD" }), null);
});

test("a feed keeps only quotes with a real price, and is empty rather than wrong", () => {
  const feed = readFeed({
    source: "SYNTHETIC",
    updatedAt: 5000,
    quotes: [
      {
        symbol: "EUR/USD",
        price: 1.08,
        precision: 5,
        changePct: 0.4,
        history: [
          { time: 0, price: 1.07 },
          { time: 5000, price: 1.08 },
          { time: "later", price: 1.09 },
        ],
      },
      { symbol: "BTC/USD", price: Number.NaN },
      { symbol: "NOPE", price: 1 },
      "not a quote",
    ],
  });
  assert.ok(feed);
  assert.equal(feed.quotes.length, 1);
  assert.deepEqual(feed.quotes[0].history, [
    { time: 0, price: 1.07 },
    { time: 5000, price: 1.08 },
  ]);
  assert.equal(
    readFeed({ source: "SYNTHETIC", updatedAt: 5000, quotes: [] }),
    null,
  );
  assert.equal(readFeed(null), null);
});

test("activity, ledger and withdrawal rows without their meaning are dropped", () => {
  assert.ok(readActivity({ id: "a1", timestamp: 5, kind: "ACCOUNT" }));
  assert.equal(readActivity({ id: "a1", timestamp: 5 }), null);
  assert.ok(
    readLedgerEntry({
      id: "l1",
      type: "WELCOME_CREDIT",
      deltaCents: 1000,
      balanceAfterCents: 1000,
      timestamp: 5,
    }),
  );
  assert.equal(
    readLedgerEntry({ id: "l1", type: "WELCOME_CREDIT", timestamp: 5 }),
    null,
  );
  assert.ok(
    readWithdrawal({
      id: "w1",
      amountCents: 5000,
      status: "Under Review",
      createdAt: 5,
    }),
  );
  assert.equal(
    readWithdrawal({
      id: "w1",
      amountCents: 5000,
      status: "PAID",
      createdAt: 5,
    }),
    null,
  );
});

test("collection reads keep the readable rows and drop only the unusable ones", () => {
  const docs = [
    { id: "t1", data: () => ({ ...accountRow(), id: undefined }) },
    { id: "t2", data: () => ({ id: "t2" }) },
  ];
  assert.deepEqual(
    readCollection(docs, readTrade),
    [],
    "neither row is a trade",
  );
  const rows = readCollection(
    [
      {
        id: "t3",
        data: () => ({
          market: "EUR/USD",
          side: "SELL",
          amountCents: 500,
          entryPrice: 1.1,
          startedAt: 1,
          status: "OPEN",
        }),
      },
      { id: "t4", data: () => ({ market: "EUR/USD" }) },
    ],
    readTrade,
  );
  assert.equal(rows.length, 1);
  assert.equal(
    rows[0].id,
    "t3",
    "the snapshot document id is used when the field is absent",
  );
});

test("readable settings are exactly the settings the write schema accepts", () => {
  // Anti-drift: the read boundary and the zod schema share SETTINGS_BOUNDS, so a
  // value the server rejects can never be presented as a stored preference.
  for (const [key, bounds] of Object.entries(SETTINGS_BOUNDS)) {
    for (const value of [bounds.min - 1, bounds.max + 1]) {
      const candidate = { ...SETTINGS, [key]: value };
      assert.equal(
        readSettings(candidate).complete,
        false,
        `${key}=${value} must be treated as unusable`,
      );
      assert.equal(
        settingsSchema.safeParse(candidate).success,
        false,
        `${key}=${value} must be rejected by the write schema too`,
      );
    }
    for (const value of [bounds.min, bounds.max]) {
      const candidate = { ...SETTINGS, [key]: value };
      assert.equal(readSettings(candidate).complete, true, `${key}=${value}`);
      assert.equal(settingsSchema.safeParse(candidate).success, true);
    }
  }
  assert.deepEqual(readSettings(SETTINGS).missing, []);
  assert.equal(readSettings(SETTINGS).complete, true);
  assert.deepEqual(readSettings(undefined).missing.length, 8);
  assert.equal(readSettings(undefined).complete, false);
});
