import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { TransactionStore } from "./support/transaction-store";
import { executeCommand } from "../src/lib/server/commands";
import { recordSessionFailure } from "../src/lib/server/worker-errors";
import { processSession } from "../src/lib/server/engine";
import { reviewWithdrawal } from "../src/lib/server/withdrawals";
import { ApiError } from "../src/lib/server/firebase";
import {
  DEFAULT_SETTINGS,
  type Account,
  type Feed,
  type LedgerEntry,
  type Session,
  type Trade,
  type Withdrawal,
  type SymbolName,
} from "../src/lib/trading/types";
import type { Command } from "../src/lib/server/validation";
import { calculatePnl } from "../src/lib/trading/strategy";
const EPOCH = 1800000000000;
function feed(
  now: number,
  prices: Partial<Record<SymbolName, number>> = { "EUR/USD": 101 },
): Feed {
  return {
    source: "SYNTHETIC",
    updatedAt: now,
    quotes: Object.entries(prices).map(([symbol, price]) => ({
      symbol: symbol as SymbolName,
      name: symbol,
      price: price!,
      precision: 5,
      changePct: 0,
      history: [100, 100, 100, 100, price!].map((price, i) => ({
        price,
        time: now - (4 - i) * 5000,
      })),
    })),
  };
}
async function fixture(markets: SymbolName[] = ["EUR/USD"]) {
  const store = new TransactionStore();
  let now = EPOCH;
  const uid = `user-${randomUUID()}`;
  const user = `users/${uid}`;
  const call = (command: Command, key = randomUUID()) =>
    executeCommand(
      { uid, email: "test@example.test" },
      command,
      key,
      () => now,
      store.firestore,
    );
  const account = () => store.read<Account>(user);
  const session = () =>
    store.read<Session>(`${user}/tradingSessions/${account().activeSessionId}`);
  const tick = (data = feed(now)) =>
    processSession(
      uid,
      account().activeSessionId!,
      data,
      () => now,
      store.firestore,
    );
  const advance = (ms = 5000) => {
    now += ms;
    store.seed("system/worker", { heartbeatAt: now });
    return now;
  };
  await call({ action: "initialize" });
  await call({ action: "balance", balanceCents: 50000 });
  await call({
    action: "settings",
    name: "Test",
    settings: {
      ...DEFAULT_SETTINGS,
      markets,
      tradeAmountCents: 10000,
      maxPositions: markets.length,
      maxSessionLossPct: 1,
    },
  });
  advance(0);
  const reconcile = () => {
    let value = 0;
    const entries = store
      .list<LedgerEntry>(`${user}/ledger`)
      .sort((a, b) => a.sequence - b.sequence);
    for (const [i, l] of entries.entries()) {
      assert.equal(l.sequence, i + 1);
      value += l.deltaCents;
      assert.equal(l.balanceAfterCents, value);
    }
    assert.equal(value, account().balanceCents);
    const trades = store.list<Trade>(`${user}/trades`);
    assert.equal(
      trades
        .filter((t) => t.status === "OPEN")
        .reduce((s, t) => s + t.amountCents, 0),
      account().reservedCents,
    );
    assert.equal(
      trades
        .filter((t) => t.status === "CLOSED")
        .reduce((s, t) => s + t.pnlCents, 0),
      account().totalPnlCents,
    );
  };
  return {
    store,
    uid,
    user,
    call,
    account,
    session,
    tick,
    advance,
    reconcile,
    now: () => now,
  };
}
test("server transactions: concurrent initialization credits each isolated account once", async () => {
  const store = new TransactionStore();
  const init = (uid: string) =>
    executeCommand(
      { uid },
      { action: "initialize" },
      randomUUID(),
      EPOCH,
      store.firestore,
    );
  await Promise.all(Array.from({ length: 12 }, () => init("alice")));
  await init("bob");
  assert.equal(store.read<Account>("users/alice").balanceCents, 1000);
  assert.equal(store.list("users/alice/ledger").length, 1);
  assert.equal(store.read<Account>("users/bob").balanceCents, 1000);
  await executeCommand(
    { uid: "alice" },
    { action: "balance", balanceCents: 52341 },
    randomUUID(),
    EPOCH,
    store.firestore,
  );
  await init("alice");
  assert.equal(store.read<Account>("users/alice").balanceCents, 52341);
  assert.equal(store.read<Account>("users/bob").balanceCents, 1000);
});
test("idempotency keys are bound to canonical payloads and never replay a different command", async () => {
  const f = await fixture();
  const key = randomUUID();
  const command: Command = { action: "balance", balanceCents: 52341 };
  await Promise.all([f.call(command, key), f.call(command, key)]);
  const snapshot = f.store.dump();
  await f.call({ balanceCents: 52341, action: "balance" }, key);
  assert.deepEqual(f.store.dump(), snapshot);
  await assert.rejects(
    f.call({ action: "balance", balanceCents: 99999 }, key),
    /different command/,
  );
  assert.equal(f.account().balanceCents, 52341);
  f.reconcile();
});
test("failed commits leave no partial balances, ledger entries, or idempotency receipts", async () => {
  const f = await fixture();
  const key = randomUUID(),
    before = f.store.dump();
  f.store.abortNextCommit = true;
  await assert.rejects(
    f.call({ action: "balance", balanceCents: 60000 }, key),
    /commit failure/,
  );
  assert.deepEqual(f.store.dump(), before);
  await f.call({ action: "balance", balanceCents: 60000 }, key);
  assert.equal(f.account().balanceCents, 60000);
  f.reconcile();
});
test("only one session opens under concurrent start; each quote executes exactly once", async () => {
  const f = await fixture();
  const results = await Promise.allSettled([
    f.call({ action: "start", durationSeconds: 300 }),
    f.call({ action: "start", durationSeconds: 300 }),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  await Promise.all([f.tick(), f.tick(), f.tick()]);
  assert.equal(f.store.list(`${f.user}/trades`).length, 1);
  assert.equal(f.session().tradesGenerated, 1);
  assert.equal(f.account().reservedCents, 10000);
  f.reconcile();
});
test("pause manages exits but opens no entries; resume preserves the original deadline", async () => {
  const f = await fixture();
  await f.call({ action: "start", durationSeconds: 300 });
  const expires = f.session().expiresAt;
  await f.tick();
  await f.call({ action: "pause" });
  f.advance();
  await f.tick(feed(f.now(), { "EUR/USD": 103 }));
  assert.equal(f.account().trades, 1);
  assert.equal(f.account().wins, 1);
  assert.equal(f.account().reservedCents, 0);
  assert.equal(f.session().tradesGenerated, 1);
  await f.call({ action: "resume" });
  assert.equal(f.session().expiresAt, expires);
  f.reconcile();
});
test("session expiry while the browser is absent settles positions before completion", async () => {
  const f = await fixture();
  await f.call({ action: "start", durationSeconds: 60 });
  const id = f.session().id;
  await f.tick();
  f.advance(65000);
  await f.tick(feed(f.now(), { "EUR/USD": 100.8 }));
  const s = f.store.read<Session>(`${f.user}/tradingSessions/${id}`);
  assert.equal(s.status, "COMPLETED");
  assert.equal(s.completedAt, f.now());
  assert.equal(s.endingBalanceCents, f.account().balanceCents);
  assert.equal(f.account().activeSessionId, null);
  assert.equal(f.account().reservedCents, 0);
  assert.equal(f.store.list(`${f.user}/trades`).length, 1);
  f.reconcile();
});
test("a transaction retry reevaluates the deadline and refuses a now-stale quote", async () => {
  const f = await fixture();
  await f.call({ action: "start", durationSeconds: 60 });
  const before = f.store.dump();
  f.store.retryNextCommit = () => {
    f.advance(61000);
  };
  await assert.rejects(f.tick(), /Stale\/future/);
  assert.equal(f.store.list(`${f.user}/trades`).length, 0);
  assert.equal(f.account().balanceCents, 50000);
  assert.equal(f.session().lastTickAt, 0);
  assert.ok(before.length);
  await f.tick();
  assert.equal(f.account().activeSessionId, null);
  f.reconcile();
});
test("resume cannot sneak past its deadline during a transaction retry", async () => {
  const f = await fixture();
  await f.call({ action: "start", durationSeconds: 60 });
  await f.call({ action: "pause" });
  f.store.retryNextCommit = () => {
    f.advance(61000);
  };
  await assert.rejects(f.call({ action: "resume" }), /expired/);
  assert.equal(f.session().status, "PAUSED");
});
test("whole-book risk closes ALL positions at the same quote regardless of query ordering", async () => {
  const f = await fixture(["EUR/USD", "GBP/USD"]);
  await f.call({ action: "start", durationSeconds: 300 });
  const id = f.session().id;
  await f.tick(feed(f.now(), { "EUR/USD": 101, "GBP/USD": 101 }));
  assert.equal(f.account().reservedCents, 20000);
  f.advance();
  await f.tick(feed(f.now(), { "EUR/USD": 101.1, "GBP/USD": 94 }));
  const closed = f.store.list<Trade>(`${f.user}/trades`);
  assert.equal(closed.length, 2);
  assert.ok(
    closed.every(
      (t) =>
        t.status === "CLOSED" &&
        t.endedAt === f.now() &&
        t.closeReason === "SESSION_LOSS_LIMIT",
    ),
  );
  assert.equal(
    f.store.read<Session>(`${f.user}/tradingSessions/${id}`).status,
    "STOPPED",
  );
  assert.equal(f.account().reservedCents, 0);
  assert.equal(f.account().wins, 1);
  assert.equal(f.account().losses, 1);
  f.reconcile();
});
test("an unrealized session loss limit settles before looser per-position stops", async () => {
  const f = await fixture(["EUR/USD", "GBP/USD"]);
  await f.call({
    action: "settings",
    name: "Test",
    settings: { ...f.account().settings, stopLossPct: 5 },
  });
  await f.call({ action: "start", durationSeconds: null });
  await f.tick(feed(f.now(), { "EUR/USD": 101, "GBP/USD": 101 }));
  f.advance();
  await f.tick(feed(f.now(), { "EUR/USD": 98, "GBP/USD": 98 }));
  assert.equal(f.account().activeSessionId, null);
  assert.equal(f.account().losses, 2);
  assert.ok(
    f.store
      .list<Trade>(`${f.user}/trades`)
      .every((t) => t.closeReason === "SESSION_LOSS_LIMIT"),
  );
  f.reconcile();
});
test("unlimited persists past 24 hours, while an explicit stop blocks all new entries", async () => {
  const f = await fixture();
  await f.call({ action: "start", durationSeconds: null });
  const id = f.session().id;
  await f.tick();
  f.advance(86400000);
  await f.tick();
  assert.equal(f.session().status, "ACTIVE");
  assert.equal(f.session().expiresAt, null);
  await f.call({ action: "stop" });
  const total = f.session().tradesGenerated;
  f.advance();
  await f.tick();
  const s = f.store.read<Session>(`${f.user}/tradingSessions/${id}`);
  assert.equal(s.status, "STOPPED");
  assert.equal(s.tradesGenerated, total);
  assert.equal(f.account().activeSessionId, null);
  f.reconcile();
});
test("corrupt, missing, duplicate, infinite, and stale quotes never mutate financial state", async () => {
  const f = await fixture();
  await f.call({ action: "start", durationSeconds: 300 });
  const good = feed(f.now());
  const bad: Feed[] = [
    { ...good, updatedAt: f.now() - 20000 },
    { ...good, quotes: [] },
    { ...good, quotes: [...good.quotes, ...good.quotes] },
    feed(f.now(), { "EUR/USD": Infinity }),
    feed(f.now(), { "EUR/USD": NaN }),
    feed(f.now(), { "EUR/USD": 0 }),
  ];
  for (const quote of bad) {
    const before = f.store.dump();
    await assert.rejects(f.tick(quote));
    assert.deepEqual(f.store.dump(), before);
  }
  await f.tick();
  f.reconcile();
});
test("a mismatched reservation or cross-session position blocks execution instead of editing balances", async () => {
  const f = await fixture();
  await f.call({ action: "start", durationSeconds: 300 });
  await f.tick();
  f.advance();
  const t = f.store.list<Trade>(`${f.user}/trades`)[0];
  f.store.seed(`${f.user}/trades/${t.id}`, {
    ...t,
    sessionId: "other-session",
  });
  const before = f.store.dump();
  await assert.rejects(f.tick(), /identity/);
  assert.deepEqual(f.store.dump(), before);
  f.store.seed(`${f.user}/trades/${t.id}`, t);
  f.store.seed(f.user, { ...f.account(), reservedCents: 10001 });
  await assert.rejects(f.tick(), /collateral/);
});
test("active settings are immutable snapshots, not changes made during a session", async () => {
  const f = await fixture();
  await f.call({ action: "start", durationSeconds: 300 });
  const original = f.session().settings;
  await f.call({
    action: "settings",
    name: "Updated",
    settings: {
      ...f.account().settings,
      tradeAmountCents: 500,
      strategy: "MEAN_REVERSION",
    },
  });
  await f.tick();
  assert.deepEqual(f.session().settings, original);
  assert.equal(f.store.list<Trade>(`${f.user}/trades`)[0].amountCents, 10000);
  assert.equal(f.store.list<Trade>(`${f.user}/trades`)[0].side, "BUY");
});
test("withdrawals reserve/release once, enforce available funds, and remain isolated by user", async () => {
  const f = await fixture();
  const request: Command = {
    action: "withdraw",
    amountCents: 40000,
    name: "Fictional Name",
    method: "Bank transfer",
    details: "Fictional account",
  };
  const key = randomUUID();
  await Promise.all([f.call(request, key), f.call(request, key)]);
  assert.equal(f.account().balanceCents, 50000);
  assert.equal(f.account().withdrawalHoldCents, 40000);
  await assert.rejects(
    f.call({ ...request, amountCents: 11000 }),
    /Insufficient/,
  );
  const w = f.store.list<Withdrawal>(`${f.user}/withdrawals`)[0];
  await Promise.allSettled([
    f.call({ action: "cancelWithdrawal", id: w.id }),
    f.call({ action: "cancelWithdrawal", id: w.id }),
  ]);
  assert.equal(f.account().withdrawalHoldCents, 0);
  assert.equal(f.account().balanceCents, 50000);
  assert.equal(f.store.list(`${f.user}/withdrawals`).length, 1);
  f.reconcile();
});
test("admin review is authorized, audited, and cannot complete a withdrawal twice", async () => {
  const f = await fixture();
  await f.call({
    action: "withdraw",
    amountCents: 5000,
    name: "Fictional Person",
    method: "PayPal",
    details: "fictional@example.test",
  });
  const w = f.store.list<Withdrawal>(`${f.user}/withdrawals`)[0];
  const body = { uid: f.uid, id: w.id, status: "Under Review" as const };
  const review = (
    status: "Under Review" | "Simulated Completed" | "Cancelled",
  ) =>
    reviewWithdrawal(
      { uid: "admin", admin: true },
      { ...body, status },
      f.now,
      f.store.firestore,
    );
  await assert.rejects(
    reviewWithdrawal(
      { uid: f.uid, admin: false },
      body,
      f.now,
      f.store.firestore,
    ),
    /authorization/,
  );
  await assert.rejects(review("Simulated Completed"), /Review/);
  await review("Under Review");
  await Promise.all([
    review("Simulated Completed"),
    review("Simulated Completed"),
  ]);
  assert.equal(f.account().balanceCents, 45000);
  assert.equal(f.account().withdrawalHoldCents, 0);
  assert.equal(f.store.list("systemEvents").length, 2);
  await assert.rejects(
    f.call({ action: "cancelWithdrawal", id: w.id }),
    /no longer/,
  );
  f.reconcile();
});
test("admin completion racing owner cancellation cannot double-debit or double-release", async () => {
  const f = await fixture();
  await f.call({
    action: "withdraw",
    amountCents: 5000,
    name: "Fictional Person",
    method: "PayPal",
    details: "fictional@example.test",
  });
  const w = f.store.list<Withdrawal>(`${f.user}/withdrawals`)[0];
  await reviewWithdrawal(
    { uid: "admin", admin: true },
    { uid: f.uid, id: w.id, status: "Under Review" },
    f.now,
    f.store.firestore,
  );
  await Promise.allSettled([
    f.call({ action: "cancelWithdrawal", id: w.id }),
    reviewWithdrawal(
      { uid: "admin", admin: true },
      { uid: f.uid, id: w.id, status: "Simulated Completed" },
      f.now,
      f.store.firestore,
    ),
  ]);
  assert.equal(f.account().withdrawalHoldCents, 0);
  assert.ok([45000, 50000].includes(f.account().balanceCents));
  f.reconcile();
});
test("NaN/infinite prices and unsafe allocations are rejected by the execution math", () => {
  for (const exit of [Infinity, NaN, -Infinity, 0, -1])
    assert.throws(() =>
      calculatePnl({ entryPrice: 100, amountCents: 100, side: "BUY" }, exit),
    );
  for (const amountCents of [
    NaN,
    Infinity,
    -1,
    0,
    10.1,
    Number.MAX_SAFE_INTEGER + 1,
  ])
    assert.throws(() =>
      calculatePnl({ entryPrice: 100, amountCents, side: "BUY" }, 101),
    );
});

test("failed settlement commit is atomic and retried without a duplicate trade result", async () => {
  const f = await fixture();
  await f.call({ action: "start", durationSeconds: 300 });
  await f.tick();
  await f.call({ action: "pause" });
  f.advance();
  const quote = feed(f.now(), { "EUR/USD": 103 });
  const before = f.store.dump();
  f.store.abortNextCommit = true;
  await assert.rejects(f.tick(quote), /commit failure/);
  assert.deepEqual(f.store.dump(), before);
  await f.tick(quote);
  await f.tick(quote);
  assert.equal(f.account().trades, 1);
  assert.equal(
    f.store
      .list<LedgerEntry>(`${f.user}/ledger`)
      .filter((l) => l.type === "TRADE_SETTLEMENT").length,
    1,
  );
  f.reconcile();
});
test("UTC daily P/L rolls forward without resetting total P/L or balances", async () => {
  const f = await fixture();
  await f.call({ action: "start", durationSeconds: null });
  await f.tick();
  await f.call({ action: "pause" });
  f.advance();
  await f.tick(feed(f.now(), { "EUR/USD": 103 }));
  const first = f.account().totalPnlCents;
  assert.ok(first > 0);
  await f.call({ action: "resume" });
  f.advance(86400000);
  await f.tick();
  await f.call({ action: "pause" });
  f.advance();
  await f.tick(feed(f.now(), { "EUR/USD": 100 }));
  assert.ok(f.account().todayPnlCents < 0);
  assert.equal(f.account().totalPnlCents, first + f.account().todayPnlCents);
  assert.equal(
    f.account().pnlDay,
    new Date(f.now()).toISOString().slice(0, 10),
  );
  f.reconcile();
});
test("zero, stale, future, and malformed worker heartbeats cannot authorize a session", async () => {
  const f = await fixture();
  for (const heartbeatAt of [
    0,
    NaN,
    Infinity,
    undefined,
    f.now() - 30000,
    f.now() + 10000,
  ]) {
    f.store.seed("system/worker", { heartbeatAt });
    await assert.rejects(
      f.call({ action: "start", durationSeconds: 300 }),
      /offline/,
    );
    assert.equal(f.account().activeSessionId, null);
  }
});
test("a user cannot cancel another account’s withdrawal by guessing its ID", async () => {
  const f = await fixture();
  await f.call({
    action: "withdraw",
    amountCents: 5000,
    name: "Fictional Person",
    method: "PayPal",
    details: "fictional@example.test",
  });
  const w = f.store.list<Withdrawal>(`${f.user}/withdrawals`)[0];
  await executeCommand(
    { uid: "bob" },
    { action: "initialize" },
    randomUUID(),
    f.now,
    f.store.firestore,
  );
  await assert.rejects(
    executeCommand(
      { uid: "bob" },
      { action: "cancelWithdrawal", id: w.id },
      randomUUID(),
      f.now,
      f.store.firestore,
    ),
    /not found/,
  );
  assert.equal(f.account().withdrawalHoldCents, 5000);
  assert.equal(f.store.read<Account>("users/bob").balanceCents, 1000);
});

test("a recovered session clears its visible execution error and records recovery without duplicating entries", async () => {
  const f = await fixture();
  await f.call({ action: "start", durationSeconds: 300 });
  await f.tick();
  const id = f.session().id;
  await recordSessionFailure(
    f.uid,
    id,
    new Error("Feed interrupted"),
    f.now,
    f.store.firestore,
  );
  assert.ok(f.session().engineError);
  f.advance();
  await f.tick();
  assert.equal(f.session().engineError, null);
  assert.equal(f.store.list<Trade>(`${f.user}/trades`).length, 1);
  assert.ok(
    f.store
      .list<{ kind: string }>(`${f.user}/activity`)
      .some((e) => e.kind === "RECOVERED"),
  );
  f.reconcile();
});

test("resume rejects malformed worker health instead of treating NaN as fresh", async () => {
  const f = await fixture();
  await f.call({ action: "start", durationSeconds: 300 });
  await f.call({ action: "pause" });
  f.store.seed("system/worker", { heartbeatAt: NaN });
  await assert.rejects(f.call({ action: "resume" }), /offline/);
  assert.equal(f.session().status, "PAUSED");
});

test("expiry is recorded as completed even when the final quote also crosses the loss limit", async () => {
  const f = await fixture();
  await f.call({ action: "start", durationSeconds: 60 });
  await f.tick();
  const id = f.session().id;
  f.advance(61000);
  await f.tick(feed(f.now(), { "EUR/USD": 80 }));
  const session = f.store.read<Session>(`${f.user}/tradingSessions/${id}`);
  assert.equal(session.status, "COMPLETED");
  assert.equal(session.stopReason, "DURATION_EXPIRED");
  assert.ok(session.totalPnlCents < 0);
  assert.equal(f.account().activeSessionId, null);
  f.reconcile();
});

test("a stored account without settings is repaired from the legacy projection and can trade again", async () => {
  const f = await fixture();
  const original = f.account();
  // What an earlier release left behind: everything but the settings object,
  // which was projected to users/{uid}/settings/trading instead.
  const stored: Record<string, unknown> = { ...original };
  delete stored.settings;
  f.store.seed(f.user, stored);

  const result = await f.call({ action: "initialize" });
  assert.match(
    result.message,
    /restored/i,
    "the caller is told that stored preferences were restored",
  );
  assert.deepEqual(
    f.account().settings,
    original.settings,
    "the user's real preferences are recovered, not defaulted away",
  );
  assert.deepEqual(
    f.store.read(`${f.user}/settings/trading`),
    original.settings,
    "the projection is written back consistently",
  );
  assert.ok(
    f.store
      .list<{ kind: string; message: string }>(`${f.user}/activity`)
      .some((e) => e.kind === "ACCOUNT" && /restored/i.test(e.message)),
    "the repair is part of the audit timeline",
  );

  // The account is fully usable again: a session starts and opens a position.
  await f.call({ action: "start", durationSeconds: 300 });
  f.advance();
  await f.tick();
  assert.equal(f.store.list<Trade>(`${f.user}/trades`)[0].amountCents, 10000);
  assert.equal(f.account().activeSessionId !== null, true);
  f.reconcile();
});

test("with no usable settings anywhere, documented defaults are restored and disclosed", async () => {
  const f = await fixture();
  const stored: Record<string, unknown> = { ...f.account() };
  delete stored.settings;
  f.store.seed(f.user, stored);
  // A legacy projection that is itself unusable must not be half-adopted.
  f.store.seed(`${f.user}/settings/trading`, { market: "EUR/USD" });
  const result = await f.call({ action: "initialize" });
  assert.match(result.message, /defaults/i);
  assert.deepEqual(f.account().settings, DEFAULT_SETTINGS);
  f.reconcile();
});

test("an account document without balances is refused with a clear reason and left untouched", async () => {
  const f = await fixture();
  const stored: Record<string, unknown> = { ...f.account() };
  delete stored.balanceCents;
  f.store.seed(f.user, stored);
  const before = f.store.dump();
  await assert.rejects(
    f.call({ action: "balance", balanceCents: 20000 }),
    (error: unknown) =>
      error instanceof ApiError &&
      error.status === 409 &&
      /incomplete or inconsistent/.test(error.message),
    "a data problem is reported as a data problem, not as a server outage",
  );
  assert.deepEqual(
    f.store.dump(),
    before,
    "no balance, ledger entry or receipt was invented",
  );
});

test("a session without a settings snapshot is restored from the account instead of blocking forever", async () => {
  const f = await fixture();
  await f.call({ action: "start", durationSeconds: 300 });
  const session = f.session();
  const stored: Record<string, unknown> = { ...session };
  delete stored.settings;
  f.store.seed(`${f.user}/tradingSessions/${session.id}`, stored);
  f.advance();

  await f.tick();
  assert.deepEqual(f.session().settings, f.account().settings);
  assert.equal(f.session().strategy, f.account().settings.strategy);
  assert.equal(
    f.store.list<Trade>(`${f.user}/trades`)[0].amountCents,
    10000,
    "the session keeps trading with the account's risk limits",
  );
  assert.ok(
    f.store
      .list<{ kind: string }>(`${f.user}/activity`)
      .some((e) => e.kind === "SETTINGS"),
    "the restored snapshot is recorded",
  );
  f.reconcile();
});
