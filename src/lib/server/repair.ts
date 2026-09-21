/**
 * Durable repair of stored documents.
 *
 * `lib/trading/documents.ts` keeps the *rendering* layer safe, but a document
 * that is missing its `settings` object is not just a display problem: the
 * server invariants refuse to authorize anything against it, so the account can
 * neither start a session nor be managed, and every command answers with a
 * generic failure. The repair below is the persisted half of the fix.
 *
 * Rules:
 *   - only `settings` is ever reconstructed, and only when the stored value is
 *     absent or unusable;
 *   - the documented `{account}/settings/trading` projection is preferred when
 *     it still holds a complete snapshot (that is where earlier releases kept
 *     preferences), otherwise the documented defaults are used;
 *   - money, balances, statistics and history are never rewritten — a document
 *     missing those is refused by the invariants instead of being "repaired"
 *     into a balance nobody agreed to;
 *   - every repair is written by the transaction that performed it and recorded
 *     in the account activity timeline, so a silently different set of trading
 *     preferences is impossible.
 */

import type { DocumentReference, Transaction } from "firebase-admin/firestore";
import { readSettings } from "../trading/documents";
import { DEFAULT_SETTINGS, type Account, type Session } from "../trading/types";

export type SettingsRestoration = {
  /** Where the restored snapshot came from. */
  source: "PROJECTION" | "DEFAULTS" | "ACCOUNT";
  /** Settings fields that were missing or unusable. */
  missing: string[];
};

/**
 * Restores `account.settings` in place (the caller persists the account) and
 * reports what happened, or returns `null` when the stored snapshot is fine.
 */
export async function restoreAccountSettings(
  tx: Transaction,
  user: DocumentReference,
  account: Account,
): Promise<SettingsRestoration | null> {
  const stored = readSettings(account.settings);
  if (stored.complete) return null;
  // Legacy preference projection. Read before any write, inside the same
  // transaction, so a concurrent settings change is seen consistently.
  const projection = await tx.get(user.collection("settings").doc("trading"));
  const legacy = projection.exists ? readSettings(projection.data()) : null;
  const restored =
    legacy && legacy.complete
      ? { ...legacy.settings, markets: [...legacy.settings.markets] }
      : { ...DEFAULT_SETTINGS, markets: [...DEFAULT_SETTINGS.markets] };
  account.settings = restored;
  return {
    source: legacy && legacy.complete ? "PROJECTION" : "DEFAULTS",
    missing: stored.missing,
  };
}

/**
 * A session freezes its settings snapshot at start. Without one the worker
 * cannot apply risk limits, so it blocked the session forever. The account's
 * current snapshot is the only defensible source; the caller records it.
 */
export function restoreSessionSettings(
  session: Session,
  account: Account,
): SettingsRestoration | null {
  const stored = readSettings(session.settings);
  if (stored.complete) return null;
  session.settings = {
    ...account.settings,
    markets: [...account.settings.markets],
  };
  // The session-level invariant requires the recorded strategy to be the
  // strategy the snapshot actually describes.
  session.strategy = account.settings.strategy;
  return { source: "ACCOUNT", missing: stored.missing };
}

/** Activity-timeline wording for a performed repair. Never claims more than it did. */
export function restorationMessage(
  restoration: SettingsRestoration,
  scope: "account" | "session",
): string {
  const fields = restoration.missing.join(", ") || "settings";
  if (scope === "session") {
    return (
      `This session had no usable trading-preference snapshot (${fields}), so your account settings were applied and recorded before it continued. ` +
      "Open positions keep their own allocation, stop and target."
    );
  }
  return restoration.source === "PROJECTION"
    ? `Your saved trading preferences were missing from this account document (${fields}) and were restored from your stored settings. Review them in Settings.`
    : `Your saved trading preferences were missing from this account document (${fields}). Documented defaults were restored so the account can trade again; review them in Settings.`;
}
