import { createHash, randomUUID } from "node:crypto";
import type { Transaction, DocumentReference } from "firebase-admin/firestore";
import { db, ApiError } from "./firebase";
import {
  DEFAULT_SETTINGS,
  type Account,
  type Session,
  type Withdrawal,
} from "../trading/types";
import type { Command } from "./validation";
import type { Firestore } from "firebase-admin/firestore";
import {
  assertAccount,
  assertSession,
  heartbeatFresh,
  readClock,
  type Clock,
} from "./invariants";
import {
  restoreAccountSettings,
  restoreSessionSettings,
  restorationMessage,
  type SettingsRestoration,
} from "./repair";

/**
 * Document invariants throw plain `Error`s. Turning them into an `ApiError`
 * keeps the real reason in front of the caller: a stored document that cannot
 * be trusted is a data problem with an actionable explanation, not the
 * "Firebase server unavailable" infrastructure message it used to become.
 */
function documentProblem(error: unknown, scope: "account" | "session") {
  const detail = error instanceof Error ? error.message : "invariant failed";
  return new ApiError(
    409,
    `This ${scope} document is incomplete or inconsistent, so the command was blocked to protect your simulated funds. No balance or history was changed. (${detail})`,
  );
}
function fingerprint(command: Command) {
  const canonical = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(canonical)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.entries(value)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, v]) => [k, canonical(v)]),
          )
        : value;
  return createHash("sha256")
    .update(JSON.stringify(canonical(command)))
    .digest("hex");
}
export function event(
  tx: Transaction,
  user: DocumentReference,
  sessionId: string | null,
  kind: string,
  message: string,
  now: number,
  account: Account,
) {
  const ref = user.collection("activity").doc();
  account.activitySequence = (account.activitySequence || 0) + 1;
  tx.set(ref, {
    id: ref.id,
    sequence: account.activitySequence,
    userId: user.id,
    sessionId,
    timestamp: now,
    kind,
    message,
  });
}
export function ledger(
  tx: Transaction,
  user: DocumentReference,
  type: string,
  deltaCents: number,
  account: Account,
  referenceId: string,
  now: number,
) {
  const ref = user.collection("ledger").doc();
  account.ledgerSequence = (account.ledgerSequence || 0) + 1;
  tx.set(ref, {
    id: ref.id,
    userId: user.id,
    type,
    deltaCents,
    balanceAfterCents: account.balanceCents,
    sequence: account.ledgerSequence,
    referenceId,
    timestamp: now,
  });
}
export function saveAccount(
  tx: Transaction,
  user: DocumentReference,
  account: Account,
) {
  assertAccount(account, user.id);
  tx.set(user, account);
  tx.set(user.collection("portfolio").doc("current"), {
    balanceCents: account.balanceCents,
    availableCents:
      account.balanceCents -
      account.reservedCents -
      account.withdrawalHoldCents,
    reservedCents: account.reservedCents,
    updatedAt: account.updatedAt,
  });
  tx.set(user.collection("settings").doc("trading"), account.settings);
  tx.set(user.collection("settings").doc("profile"), {
    name: account.name,
    email: account.email,
  });
}
export async function executeCommand(
  identity: { uid: string; email?: string; name?: string },
  command: Command,
  key: string,
  clock: Clock = Date.now,
  store: Firestore = db(),
) {
  const requestFingerprint = fingerprint(command);
  const user = store.doc(`users/${identity.uid}`);
  const receipt = user.collection("commands").doc(key);
  return store.runTransaction(async (tx) => {
    const [accountSnap, receiptSnap] = await Promise.all([
      tx.get(user),
      tx.get(receipt),
    ]);
    if (receiptSnap.exists) {
      if (receiptSnap.data()!.fingerprint !== requestFingerprint)
        throw new ApiError(
          409,
          "This idempotency key belongs to a different command.",
        );
      return receiptSnap.data()!.result as { message: string };
    }
    let now = readClock(clock);
    if (!accountSnap.exists) {
      if (command.action !== "initialize")
        throw new ApiError(409, "Initialize your account first.");
      const account: Account = {
        uid: identity.uid,
        email: identity.email || "",
        name: identity.name || identity.email?.split("@")[0] || "Trader",
        currency: "USD",
        accountType: "SIMULATION",
        status: "ACTIVE",
        balanceCents: 1000,
        ledgerSequence: 0,
        activitySequence: 0,
        startingBalanceCents: 1000,
        reservedCents: 0,
        withdrawalHoldCents: 0,
        totalPnlCents: 0,
        todayPnlCents: 0,
        pnlDay: new Date(now).toISOString().slice(0, 10),
        trades: 0,
        wins: 0,
        losses: 0,
        settings: DEFAULT_SETTINGS,
        activeSessionId: null,
        createdAt: now,
        updatedAt: now,
      };
      ledger(tx, user, "WELCOME_CREDIT", 1000, account, "welcome", now);
      event(
        tx,
        user,
        null,
        "ACCOUNT",
        "Account created. $10.00 in simulated welcome funds credited once.",
        now,
        account,
      );
      saveAccount(tx, user, account);
      const result = { message: "Welcome. Your simulated account is ready." };
      tx.set(receipt, {
        result,
        timestamp: now,
        fingerprint: requestFingerprint,
      });
      return result;
    }
    const account = accountSnap.data() as Account;
    if (account.accountType !== "SIMULATION" || account.status !== "ACTIVE")
      throw new ApiError(403, "This is not an active simulation account.");
    // Documents written by an earlier release may have no settings object at
    // all; the account must be usable (and its risk limits knowable) before any
    // command can be executed against it.
    const notes: string[] = [];
    const accountRestoration = await restoreAccountSettings(tx, user, account);
    try {
      assertAccount(account, user.id);
    } catch (error) {
      throw documentProblem(error, "account");
    }
    const sessionRef = account.activeSessionId
      ? user.collection("tradingSessions").doc(account.activeSessionId)
      : null;
    const sessionSnap = sessionRef ? await tx.get(sessionRef) : null;
    const session = sessionSnap?.exists
      ? (sessionSnap.data() as Session)
      : null;
    if (account.activeSessionId && !session)
      throw new ApiError(
        409,
        "The active session is missing. Execution is blocked pending inspection.",
      );
    let sessionRestoration: SettingsRestoration | null = null;
    if (session) {
      sessionRestoration = restoreSessionSettings(session, account);
      try {
        assertSession(session, user.id, account.activeSessionId!);
      } catch (error) {
        throw documentProblem(error, "session");
      }
    }
    const withdrawalRef =
      command.action === "cancelWithdrawal"
        ? user.collection("withdrawals").doc(command.id)
        : null;
    const withdrawalSnap = withdrawalRef ? await tx.get(withdrawalRef) : null;
    const healthSnap =
      command.action === "start" || command.action === "resume"
        ? await tx.get(store.doc("system/worker"))
        : null;
    now = readClock(clock); // Firestore retries/reads must not freeze a session deadline.
    // Every read is done: repairs are written and audited here, before the
    // command's own transaction work.
    if (accountRestoration) {
      notes.push(restorationMessage(accountRestoration, "account"));
      event(tx, user, null, "ACCOUNT", notes.at(-1)!, now, account);
    }
    if (sessionRestoration && session && sessionRef) {
      notes.push(restorationMessage(sessionRestoration, "session"));
      event(tx, user, session.id, "SETTINGS", notes.at(-1)!, now, account);
      // Persist the snapshot: not every command below rewrites the session, and
      // a repair that lived only in memory would be a false audit record.
      tx.set(sessionRef, session);
    }
    let message = "Account is ready.";
    switch (command.action) {
      case "initialize":
        break;
      case "start": {
        if (session || account.reservedCents)
          throw new ApiError(
            409,
            "Stop or complete the current session before starting another.",
          );
        if (
          !healthSnap?.exists ||
          !heartbeatFresh(healthSnap.data()!.heartbeatAt, now)
        )
          throw new ApiError(
            503,
            "The trading worker is offline. Start the server worker before trading.",
          );
        if (
          account.settings.tradeAmountCents >
          Math.min(
            account.balanceCents * 0.25,
            account.balanceCents - account.withdrawalHoldCents,
          )
        )
          throw new ApiError(
            400,
            "Trade size exceeds available funds or the 25% per-position risk limit. Update your settings.",
          );
        const id = randomUUID();
        const next: Session = {
          id,
          userId: user.id,
          startedAt: now,
          expiresAt:
            command.durationSeconds === null
              ? null
              : now + command.durationSeconds * 1000,
          durationSeconds: command.durationSeconds,
          status: "ACTIVE",
          aiStatus: "SCANNING",
          strategy: account.settings.strategy,
          settings: account.settings,
          startingBalanceCents: account.balanceCents,
          endingBalanceCents: null,
          totalPnlCents: 0,
          tradesGenerated: 0,
          completedAt: null,
          lastTickAt: 0,
          stopReason: null,
        };
        tx.create(user.collection("tradingSessions").doc(id), next);
        tx.set(store.doc(`workQueue/${user.id}`), {
          userId: user.id,
          sessionId: id,
        });
        account.activeSessionId = id;
        message = "AI session started. Scanning configured synthetic markets.";
        event(tx, user, id, "SESSION", message, now, account);
        break;
      }
      case "pause":
      case "resume":
      case "stop": {
        if (!session || !sessionRef)
          throw new ApiError(409, "There is no current session.");
        if (command.action === "resume") {
          if (session.status !== "PAUSED")
            throw new ApiError(409, "Only a paused session can resume.");
          if (session.expiresAt !== null && now >= session.expiresAt)
            throw new ApiError(
              409,
              "This session has expired. The worker will settle it.",
            );
          if (
            !healthSnap?.exists ||
            !heartbeatFresh(healthSnap.data()!.heartbeatAt, now)
          )
            throw new ApiError(503, "The trading worker is offline.");
        }
        if (command.action === "pause" && session.status !== "ACTIVE")
          throw new ApiError(409, "Only an active session can pause.");
        session.status =
          command.action === "stop"
            ? "STOPPING"
            : command.action === "pause"
              ? "PAUSED"
              : "ACTIVE";
        session.aiStatus =
          command.action === "stop"
            ? "AI STOPPED"
            : command.action === "pause"
              ? "SESSION PAUSED"
              : "SCANNING";
        if (command.action === "stop") session.stopReason = "USER_STOP";
        tx.set(sessionRef, session);
        message =
          command.action === "stop"
            ? "AI stopped opening trades. The worker will close positions at its next quote."
            : command.action === "pause"
              ? "Session paused. Existing positions remain managed; the deadline is unchanged."
              : "AI resumed with its original deadline.";
        event(tx, user, session.id, "SESSION", message, now, account);
        break;
      }
      case "settings": {
        account.name = command.name;
        account.settings = command.settings;
        message =
          "Settings saved. Strategy changes apply to your next session.";
        event(tx, user, null, "SETTINGS", message, now, account);
        break;
      }
      case "balance": {
        if (session || account.reservedCents || account.withdrawalHoldCents)
          throw new ApiError(
            409,
            "End your session and resolve withdrawal holds before configuring funds.",
          );
        const delta = command.balanceCents - account.balanceCents;
        account.balanceCents = command.balanceCents;
        ledger(tx, user, "DEMO_ADJUSTMENT", delta, account, key, now);
        message =
          "Simulated funds configured. The adjustment is recorded in your ledger; history is preserved.";
        event(tx, user, null, "ACCOUNT", message, now, account);
        break;
      }
      case "withdraw": {
        if (
          command.amountCents >
          account.balanceCents -
            account.reservedCents -
            account.withdrawalHoldCents
        )
          throw new ApiError(400, "Insufficient available simulated funds.");
        const id = randomUUID();
        const withdrawal: Withdrawal = {
          id,
          userId: user.id,
          amountCents: command.amountCents,
          name: command.name,
          method: command.method,
          details: command.details,
          status: "Submitted",
          createdAt: now,
          updatedAt: now,
        };
        tx.create(user.collection("withdrawals").doc(id), withdrawal);
        account.withdrawalHoldCents += command.amountCents;
        ledger(tx, user, "WITHDRAWAL_HOLD", 0, account, id, now);
        message =
          "Simulated withdrawal request submitted. No real funds will be transferred.";
        event(tx, user, null, "WITHDRAWAL", message, now, account);
        break;
      }
      case "cancelWithdrawal": {
        if (!withdrawalSnap?.exists || !withdrawalRef)
          throw new ApiError(404, "Request not found.");
        const withdrawal = withdrawalSnap.data() as Withdrawal;
        if (!["Submitted", "Under Review"].includes(withdrawal.status))
          throw new ApiError(409, "This request can no longer be cancelled.");
        tx.update(withdrawalRef, { status: "Cancelled", updatedAt: now });
        account.withdrawalHoldCents -= withdrawal.amountCents;
        ledger(tx, user, "WITHDRAWAL_RELEASE", 0, account, withdrawal.id, now);
        message = "Request cancelled. Simulated funds released.";
        event(tx, user, null, "WITHDRAWAL", message, now, account);
        break;
      }
    }
    account.updatedAt = now;
    saveAccount(tx, user, account);
    // The repaired document is part of the command result, so the client can
    // tell the user that stored preferences were restored instead of silently
    // trading with different settings.
    const result = {
      message: notes.length ? `${message} ${notes.join(" ")}` : message,
    };
    tx.set(receipt, {
      result,
      timestamp: now,
      fingerprint: requestFingerprint,
    });
    return result;
  });
}
