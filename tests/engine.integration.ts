// Run ONLY against the official Firebase emulator; never against production.
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../src/lib/server/firebase";
import { executeCommand } from "../src/lib/server/commands";
import { accountPath } from "../src/lib/trading/paths";
import { processSession } from "../src/lib/server/engine";
import {
  DEFAULT_SETTINGS,
  type Account,
  type Feed,
  type Session,
  type Trade,
} from "../src/lib/trading/types";
const enabled = !!process.env.FIRESTORE_EMULATOR_HOST;
const feed = (now: number, price = 101): Feed => ({
  source: "SYNTHETIC",
  updatedAt: now,
  quotes: [
    {
      symbol: "EUR/USD",
      name: "Euro",
      price,
      precision: 5,
      changePct: 0,
      history: [100, 100, 100, 100, price].map((price, i) => ({
        time: now - (4 - i) * 5000,
        price,
      })),
    },
  ],
});
test(
  "Firestore: idempotency, ledger invariants, concurrency, pause/resume, expiry, loss, withdrawal holds",
  { skip: !enabled },
  async () => {
    assert.ok(
      process.env.FIREBASE_PROJECT_ID?.startsWith("demo-"),
      "Tests require an isolated demo-* project",
    );
    const identity = {
      uid: `test-${randomUUID()}`,
      email: "integration@example.test",
    };
    const user = db().doc(accountPath(identity.uid));
    let now = Date.now();
    const call = (
      cmd: Parameters<typeof executeCommand>[1],
      key = randomUUID(),
    ) => executeCommand(identity, cmd, key, now);
    const account = async () => (await user.get()).data() as Account;
    try {
      await Promise.all([
        call({ action: "initialize" }),
        call({ action: "initialize" }),
      ]);
      assert.equal((await account()).balanceCents, 1000);
      assert.equal(
        (await user.collection("ledger").get()).size,
        1,
        "welcome only once",
      );
      const id = randomUUID();
      await Promise.all([
        call({ action: "balance", balanceCents: 50000 }, id),
        call({ action: "balance", balanceCents: 50000 }, id),
      ]);
      assert.equal((await account()).balanceCents, 50000);
      assert.equal(
        (await user.collection("ledger").get()).size,
        2,
        "exactly one adjustment",
      );
      await call({ action: "initialize" });
      assert.equal(
        (await account()).balanceCents,
        50000,
        "login never resets funds",
      );
      await call({
        action: "settings",
        name: "Test",
        settings: {
          ...DEFAULT_SETTINGS,
          markets: ["EUR/USD"],
          tradeAmountCents: 10000,
          maxPositions: 1,
        },
      });
      await db().doc("system/worker").set({ heartbeatAt: now });
      await Promise.allSettled([
        call({ action: "start", durationSeconds: 300 }),
        call({ action: "start", durationSeconds: 300 }),
      ]);
      assert.equal(
        (await user.collection("tradingSessions").get()).size,
        1,
        "one simultaneous session",
      );
      const sid = (await account()).activeSessionId!;
      const sessionRef = user.collection("tradingSessions").doc(sid);
      const original = (await sessionRef.get()).data() as Session;
      await Promise.all([
        processSession(identity.uid, sid, feed(now), now),
        processSession(identity.uid, sid, feed(now), now),
      ]);
      let positions = await user.collection("trades").get();
      assert.equal(positions.size, 1, "duplicate quote executes once");
      assert.equal((await account()).reservedCents, 10000);
      now += 5000;
      await call({ action: "pause" });
      await processSession(identity.uid, sid, feed(now, 103), now);
      let a = await account();
      assert.ok(
        a.balanceCents > 50000,
        "target reached and net winning result recorded",
      );
      assert.equal(a.reservedCents, 0);
      assert.equal(a.trades, 1);
      assert.equal(
        (await user.collection("trades").get()).size,
        1,
        "pause closes but opens no new trades",
      );
      await call({ action: "resume" });
      assert.equal(
        (await sessionRef.get()).data()!.expiresAt,
        original.expiresAt,
        "pause never extends expiry",
      );
      now += 5000;
      await processSession(identity.uid, sid, feed(now, 101), now);
      now += 5000;
      await call({ action: "stop" });
      await processSession(identity.uid, sid, feed(now, 99), now);
      a = await account();
      assert.equal(a.trades, 2);
      assert.equal(a.losses, 1);
      assert.equal(a.activeSessionId, null);
      assert.equal(a.reservedCents, 0);
      const finished = (await sessionRef.get()).data() as Session;
      assert.equal(finished.status, "STOPPED");
      assert.equal(finished.endingBalanceCents, a.balanceCents);
      assert.ok(finished.completedAt);
      const ledger = (await user.collection("ledger").get()).docs.map((d) =>
        d.data(),
      );
      assert.equal(
        ledger.reduce((s, l) => s + l.deltaCents, 0),
        a.balanceCents,
        "balance equals immutable ledger deltas",
      );
      const ordered = [...ledger].sort((a, b) => a.sequence - b.sequence);
      let reconciled = 0;
      ordered.forEach((entry, index) => {
        reconciled += entry.deltaCents;
        assert.equal(entry.sequence, index + 1);
        assert.equal(entry.balanceAfterCents, reconciled);
      });
      const closed = (await user.collection("trades").get()).docs.map(
        (d) => d.data() as Trade,
      );
      assert.equal(
        closed.reduce((s, t) => s + t.pnlCents, 0),
        a.totalPnlCents,
      );
      assert.equal(finished.totalPnlCents, a.totalPnlCents);
      await call({
        action: "withdraw",
        amountCents: 1000,
        name: "Fictional Person",
        method: "Bank transfer",
        details: "Fictional test account",
      });
      const withdrawal = (await user.collection("withdrawals").get()).docs[0];
      assert.equal((await account()).withdrawalHoldCents, 1000);
      assert.equal((await account()).balanceCents, a.balanceCents);
      await Promise.allSettled([
        call({ action: "cancelWithdrawal", id: withdrawal.id }),
        call({ action: "cancelWithdrawal", id: withdrawal.id }),
      ]);
      assert.equal(
        (await account()).withdrawalHoldCents,
        0,
        "concurrent cancel releases only once",
      );
      await db().doc("system/worker").set({ heartbeatAt: now });
      await call({ action: "start", durationSeconds: 60 });
      const expiring = (await account()).activeSessionId!;
      await processSession(identity.uid, expiring, feed(now), now);
      now += 61000;
      await processSession(identity.uid, expiring, feed(now, 100.5), now);
      assert.equal(
        (await user.collection("tradingSessions").doc(expiring).get()).data()!
          .status,
        "COMPLETED",
      );
      assert.equal((await account()).activeSessionId, null);
      positions = await user
        .collection("trades")
        .where("status", "==", "OPEN")
        .get();
      assert.equal(positions.size, 0, "expiry liquidates before completion");
      now += 5000;
      await db().doc("system/worker").set({ heartbeatAt: now });
      await call({ action: "start", durationSeconds: null });
      const unlimited = (await account()).activeSessionId!;
      await processSession(identity.uid, unlimited, feed(now), now);
      now += 86400000;
      await processSession(identity.uid, unlimited, feed(now, 101), now);
      assert.equal(
        (await user.collection("tradingSessions").doc(unlimited).get()).data()!
          .status,
        "ACTIVE",
        "unlimited does not expire with browser closed",
      );
      await call({ action: "stop" });
      now += 5000;
      await processSession(identity.uid, unlimited, feed(now), now);
      const before = (await account()).balanceCents;
      await call({ action: "initialize" });
      assert.equal((await account()).balanceCents, before);
      const replayKey = randomUUID();
      await call({ action: "balance", balanceCents: 52341 }, replayKey);
      await assert.rejects(
        call({ action: "balance", balanceCents: 99999 }, replayKey),
        /different command/,
      );
      await call({
        action: "settings",
        name: "Risk test",
        settings: {
          ...DEFAULT_SETTINGS,
          markets: ["EUR/USD", "GBP/USD"],
          tradeAmountCents: 10000,
          maxPositions: 2,
          maxSessionLossPct: 1,
        },
      });
      now += 5000;
      await db().doc("system/worker").set({ heartbeatAt: now });
      await call({ action: "start", durationSeconds: 300 });
      const riskSession = (await account()).activeSessionId!;
      const multiFeed = (eur: number, gbp: number): Feed => ({
        source: "SYNTHETIC",
        updatedAt: now,
        quotes: [
          feed(now, eur).quotes[0],
          { ...feed(now, gbp).quotes[0], symbol: "GBP/USD" },
        ],
      });
      await processSession(identity.uid, riskSession, multiFeed(101, 101), now);
      now += 5000;
      await processSession(
        identity.uid,
        riskSession,
        multiFeed(101.1, 94),
        now,
      );
      const safetyTrades = (await user.collection("trades").get()).docs
        .map((d) => d.data() as Trade)
        .filter((t) => t.sessionId === riskSession);
      assert.equal(safetyTrades.length, 2);
      assert.ok(
        safetyTrades.every(
          (t) =>
            t.status === "CLOSED" &&
            t.endedAt === now &&
            t.closeReason === "SESSION_LOSS_LIMIT",
        ),
      );
      assert.equal((await account()).reservedCents, 0);
      assert.equal((await account()).activeSessionId, null);
    } finally {
      await db().recursiveDelete(user);
      await db().doc(`workQueue/${identity.uid}`).delete();
      await db().terminate();
    }
  },
);
