import { randomUUID } from "node:crypto";
import type { Firestore } from "firebase-admin/firestore";
import {
  assertAccount,
  assertFeed,
  assertPositions,
  assertSession,
  readClock,
  type Clock,
} from "./invariants";
import { db } from "./firebase";
import { event, ledger, saveAccount } from "./commands";
import {
  restoreAccountSettings,
  restoreSessionSettings,
  restorationMessage,
} from "./repair";
import {
  analyze,
  calculatePnl,
  exitReason,
  riskAllows,
  STRATEGY_VERSION,
} from "../trading/strategy";
import type { Account, Session, Feed, Trade } from "../trading/types";
import { accountPath, workQueuePath } from "../trading/paths";
// The only execution adapter implemented is paper trading. There is no broker/order endpoint.
export interface ExecutionAdapter {
  readonly environment: "SIMULATION";
  settle(trade: Trade, exit: number): { pnlCents: number; feesCents: number };
}
export class PaperExecution implements ExecutionAdapter {
  readonly environment = "SIMULATION" as const;
  settle(trade: Trade, exit: number) {
    return calculatePnl(trade, exit);
  }
}
export async function processSession(
  userId: string,
  sessionId: string,
  feed: Feed,
  clock: Clock = Date.now,
  store: Firestore = db(),
) {
  const user = store.doc(accountPath(userId));
  const sessionRef = user.collection("tradingSessions").doc(sessionId);
  await store.runTransaction(async (tx) => {
    const [a, s, p] = await Promise.all([
      tx.get(user),
      tx.get(sessionRef),
      tx.get(user.collection("trades").where("status", "==", "OPEN")),
    ]);
    if (!a.exists) {
      tx.delete(store.doc(workQueuePath(userId)));
      return;
    }
    if (!s.exists)
      throw new Error("Active session document is missing; execution blocked.");
    const now = readClock(clock);
    const account = a.data() as Account;
    // A stored document from an earlier release may have no settings object.
    // The worker refuses to trade without risk limits, so it restores them here
    // (recorded below) instead of failing every tick forever.
    const accountRestoration = await restoreAccountSettings(tx, user, account);
    assertAccount(account, userId);
    const session = s.data() as Session;
    if (
      account.activeSessionId !== sessionId ||
      !["ACTIVE", "PAUSED", "STOPPING"].includes(session.status)
    )
      return;
    const sessionRestoration = restoreSessionSettings(session, account);
    assertSession(session, userId, sessionId);
    if (accountRestoration)
      event(
        tx,
        user,
        null,
        "ACCOUNT",
        restorationMessage(accountRestoration, "account"),
        now,
        account,
      );
    if (sessionRestoration)
      event(
        tx,
        user,
        session.id,
        "SETTINGS",
        restorationMessage(sessionRestoration, "session"),
        now,
        account,
      );
    assertFeed(feed, now, session.settings.markets);
    if (session.lastTickAt >= feed.updatedAt) {
      // Retries/multiple workers cannot execute a quote twice, but a repair
      // found during the retry still has to be persisted with its audit event.
      if (accountRestoration || sessionRestoration) {
        saveAccount(tx, user, account);
        tx.set(sessionRef, session);
      }
      return;
    }
    const cfg = session.settings;
    const positions = p.docs.map((d) => d.data() as Trade);
    assertPositions(positions, account, sessionId);
    for (const doc of p.docs)
      if (doc.id !== doc.data().id)
        throw new Error("Position document ID mismatch.");
    // Mark the whole book BEFORE settling anything. Risk outcomes do not depend
    // on Firestore query order, and every position exits on the same safety tick.
    const marked = positions.map((trade) => {
      const quote = feed.quotes.find((q) => q.symbol === trade.market);
      if (!quote) throw new Error(`Missing quote for ${trade.market}`);
      return {
        trade,
        quote,
        result: new PaperExecution().settle(trade, quote.price),
        normalExit: exitReason(trade, quote.price, now, cfg),
      };
    });
    const lossLimit = -Math.round(
      (session.startingBalanceCents * cfg.maxSessionLossPct) / 100,
    );
    const equityPnl =
      session.totalPnlCents +
      marked.reduce((sum, p) => sum + p.result.pnlCents, 0);
    const projectedRealized =
      session.totalPnlCents +
      marked
        .filter((p) => p.normalExit)
        .reduce((sum, p) => sum + p.result.pnlCents, 0);
    const safety =
      Math.min(session.totalPnlCents, equityPnl, projectedRealized) <=
      lossLimit;
    const expired = session.expiresAt !== null && now >= session.expiresAt;
    const ending = expired || session.status === "STOPPING" || safety;
    // Preserve an already-requested stop; otherwise expiry completes the session
    // even if its final closing quote also crosses a risk limit.
    if (session.status === "STOPPING") session.stopReason ||= "USER_STOP";
    else if (expired) session.stopReason = "DURATION_EXPIRED";
    else if (safety) session.stopReason = "SESSION_LOSS_LIMIT";
    if (session.lastTickAt && now - session.lastTickAt > 30000)
      event(
        tx,
        user,
        session.id,
        "WARNING",
        "Worker interruption detected. Resuming at the current quote; no missed trades or prices were fabricated.",
        now,
        account,
      );
    let open = 0;
    const occupied = new Set<string>();
    let closed = false;
    for (const { trade, quote, result, normalExit } of marked) {
      const reason = ending ? session.stopReason || "USER_STOP" : normalExit;
      if (reason) {
        const done: Trade = {
          ...trade,
          ...result,
          currentPrice: quote.price,
          exitPrice: quote.price,
          endedAt: now,
          status: "CLOSED",
          result:
            result.pnlCents > 0
              ? "WIN"
              : result.pnlCents < 0
                ? "LOSS"
                : "BREAK_EVEN",
          closeReason: reason,
        };
        tx.set(user.collection("trades").doc(trade.id), done);
        account.balanceCents += result.pnlCents;
        account.reservedCents -= trade.amountCents;
        account.totalPnlCents += result.pnlCents;
        const day = new Date(now).toISOString().slice(0, 10);
        account.todayPnlCents =
          (account.pnlDay === day ? account.todayPnlCents : 0) +
          result.pnlCents;
        account.pnlDay = day;
        account.trades++;
        if (result.pnlCents > 0) account.wins++;
        if (result.pnlCents < 0) account.losses++;
        session.totalPnlCents += result.pnlCents;
        ledger(
          tx,
          user,
          "TRADE_SETTLEMENT",
          result.pnlCents,
          account,
          trade.id,
          now,
        );
        event(
          tx,
          user,
          session.id,
          "TRADE CLOSED",
          `${trade.market} ${trade.side} closed: ${(result.pnlCents / 100).toFixed(2)} USD net (${reason}). Balance: ${(account.balanceCents / 100).toFixed(2)} USD simulated.`,
          now,
          account,
        );
        closed = true;
      } else {
        tx.update(user.collection("trades").doc(trade.id), {
          currentPrice: quote.price,
          ...result,
        });
        open++;
        occupied.add(trade.market);
        event(
          tx,
          user,
          session.id,
          "MONITORING",
          `${trade.market} position monitored at ${quote.price}. Unrealized net P/L: ${(result.pnlCents / 100).toFixed(2)} USD.`,
          now,
          account,
        );
      }
    }
    if (ending && open === 0) {
      session.status =
        session.stopReason === "DURATION_EXPIRED" ? "COMPLETED" : "STOPPED";
      session.aiStatus =
        session.status === "COMPLETED" ? "SESSION COMPLETED" : "AI STOPPED";
      session.completedAt = now;
      session.endingBalanceCents = account.balanceCents;
      account.activeSessionId = null;
      tx.delete(store.doc(workQueuePath(userId)));
      event(
        tx,
        user,
        session.id,
        "SESSION",
        `${session.aiStatus}. Net session P/L: ${(session.totalPnlCents / 100).toFixed(2)} USD.`,
        now,
        account,
      );
    } else if (ending) {
      session.status = "STOPPING";
      session.aiStatus = "AI STOPPED";
    } else if (session.status === "PAUSED") {
      session.aiStatus = "SESSION PAUSED";
    } else {
      session.aiStatus = closed
        ? "TRADE CLOSED"
        : open
          ? "MONITORING"
          : "SCANNING";
      event(
        tx,
        user,
        session.id,
        "SCANNING",
        "Market scan started.",
        now,
        account,
      );
      for (const quote of feed.quotes.filter((q) =>
        cfg.markets.includes(q.symbol),
      )) {
        const analysis = analyze(quote, cfg.strategy);
        event(
          tx,
          user,
          session.id,
          "ANALYZING",
          `${quote.symbol} analyzed. ${analysis.decision}: ${analysis.reason}`,
          now,
          account,
        );
        if (analysis.decision === "WAIT" || occupied.has(quote.symbol))
          continue;
        event(
          tx,
          user,
          session.id,
          "SIGNAL FOUND",
          `${quote.symbol}: ${analysis.decision} signal generated.`,
          now,
          account,
        );
        if (
          !riskAllows(
            account.balanceCents,
            account.balanceCents -
              account.reservedCents -
              account.withdrawalHoldCents,
            open,
            cfg,
          )
        ) {
          event(
            tx,
            user,
            session.id,
            "RISK",
            `${quote.symbol}: signal skipped. Position count, available funds, or 25% allocation limit reached.`,
            now,
            account,
          );
          continue;
        }
        const side = analysis.decision;
        const direction = side === "BUY" ? 1 : -1;
        const id = randomUUID();
        const trade: Trade = {
          id,
          userId,
          sessionId,
          market: quote.symbol,
          side,
          amountCents: cfg.tradeAmountCents,
          entryPrice: quote.price,
          currentPrice: quote.price,
          exitPrice: null,
          quantity: cfg.tradeAmountCents / 100 / quote.price,
          stopLoss: quote.price * (1 - (direction * cfg.stopLossPct) / 100),
          takeProfit: quote.price * (1 + (direction * cfg.takeProfitPct) / 100),
          startedAt: now,
          endedAt: null,
          pnlCents: 0,
          feesCents: 0,
          status: "OPEN",
          result: null,
          strategyVersion: STRATEGY_VERSION,
          aiDecision: side,
          reason: analysis.reason,
          closeReason: null,
          source: "SYNTHETIC",
        };
        tx.create(user.collection("trades").doc(id), trade);
        account.reservedCents += trade.amountCents;
        open++;
        occupied.add(trade.market);
        session.tradesGenerated++;
        session.aiStatus = "TRADE OPEN";
        event(
          tx,
          user,
          session.id,
          "TRADE OPEN",
          `${quote.symbol} ${side} simulated position opened at ${quote.price}. Allocation: ${(trade.amountCents / 100).toFixed(2)} USD.`,
          now,
          account,
        );
      }
    }
    if (session.engineError)
      event(
        tx,
        user,
        session.id,
        "RECOVERED",
        "Session processing recovered after successful validation of account state and fresh quotes.",
        now,
        account,
      );
    session.engineError = null;
    session.lastTickAt = feed.updatedAt;
    account.updatedAt = now;
    saveAccount(tx, user, account);
    tx.set(sessionRef, session);
  });
}
