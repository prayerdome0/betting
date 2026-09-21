import { test } from "node:test";
import assert from "node:assert/strict";
import { connectionLabel } from "../src/lib/trading/status";
import { heartbeatFresh } from "../src/lib/server/invariants";
import { recordSessionFailure } from "../src/lib/server/worker-errors";
import { TransactionStore } from "./support/transaction-store";
import {
  accountPath,
  SYSTEM_EVENTS_COLLECTION,
} from "../src/lib/trading/paths";
const ALICE = accountPath("alice");
test("cached or offline snapshots are never labelled as connected", () => {
  assert.match(
    connectionLabel({
      online: false,
      fromCache: false,
      accountExists: true,
      failed: false,
    }),
    /Offline/,
  );
  assert.match(
    connectionLabel({
      online: true,
      fromCache: true,
      accountExists: true,
      failed: false,
    }),
    /cached/,
  );
  assert.match(
    connectionLabel({
      online: true,
      fromCache: false,
      accountExists: true,
      failed: true,
    }),
    /error/,
  );
  assert.equal(
    connectionLabel({
      online: true,
      fromCache: false,
      accountExists: true,
      failed: false,
    }),
    "Firestore connected",
  );
  assert.match(
    connectionLabel({
      online: true,
      fromCache: false,
      accountExists: false,
      failed: false,
    }),
    /initialization/,
  );
});
test("worker freshness does not accept NaN, infinite, missing, future, or old timestamps", () => {
  const now = 1800000000000;
  for (const value of [
    undefined,
    null,
    NaN,
    Infinity,
    0,
    now - 30000,
    now + 5001,
  ])
    assert.equal(heartbeatFresh(value, now), false);
  assert.equal(heartbeatFresh(now - 10000, now), true);
});
test("session failures are visible, deduplicated, and never change trades or balances", async () => {
  const store = new TransactionStore();
  store.seed(ALICE, { activeSessionId: "s1", balanceCents: 50000 });
  store.seed(`${ALICE}/tradingSessions/s1`, { id: "s1", status: "ACTIVE" });
  await recordSessionFailure(
    "alice",
    "s1",
    new Error("Internal failure"),
    1000,
    store.firestore,
  );
  await recordSessionFailure(
    "alice",
    "s1",
    new Error("Internal failure"),
    2000,
    store.firestore,
  );
  assert.equal(store.list(SYSTEM_EVENTS_COLLECTION).length, 1);
  assert.equal(store.read<{ balanceCents: number }>(ALICE).balanceCents, 50000);
  const session = store.read<{
    engineError: { message: string; occurredAt: number };
  }>(`${ALICE}/tradingSessions/s1`);
  assert.equal(session.engineError.occurredAt, 1000);
  assert.ok(!session.engineError.message.includes("Internal failure"));
  assert.equal(store.list(`${ALICE}/trades`).length, 0);
});
test("a delayed error from an old job cannot mark the new session as broken", async () => {
  const store = new TransactionStore();
  store.seed(ALICE, { activeSessionId: "s2" });
  store.seed(`${ALICE}/tradingSessions/s1`, {
    id: "s1",
    status: "COMPLETED",
  });
  store.seed(`${ALICE}/tradingSessions/s2`, { id: "s2", status: "ACTIVE" });
  const before = store.dump();
  await recordSessionFailure(
    "alice",
    "s1",
    new Error("Old error"),
    1000,
    store.firestore,
  );
  assert.deepEqual(store.dump(), before);
});
