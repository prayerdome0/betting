import { z } from "zod";
import {
  SYMBOLS,
  type Account,
  type Feed,
  type Session,
  type Trade,
} from "../trading/types";
import { settingsSchema } from "./validation";

export type Clock = number | (() => number);
export const readClock = (clock: Clock) =>
  typeof clock === "function" ? clock() : clock;
const price = z.number().finite().positive();
const instant = z.number().int().nonnegative();
const feedSchema = z.object({
  source: z.literal("SYNTHETIC"),
  updatedAt: instant,
  quotes: z
    .array(
      z.object({
        symbol: z.enum(SYMBOLS),
        price,
        history: z
          .array(z.object({ time: instant, price }))
          .min(1)
          .max(120),
      }),
    )
    .min(1)
    .max(4),
});
export function assertFeed(
  feed: Feed,
  now: number,
  required: readonly string[] = [],
) {
  feedSchema.parse(feed);
  if (
    !Number.isFinite(now) ||
    now - feed.updatedAt > 15000 ||
    feed.updatedAt > now + 5000
  )
    throw new Error("Stale/future market feed: execution blocked.");
  const symbols = new Set(feed.quotes.map((q) => q.symbol));
  if (
    symbols.size !== feed.quotes.length ||
    required.some((s) => !symbols.has(s as (typeof SYMBOLS)[number]))
  )
    throw new Error(
      "Incomplete or duplicate market quotes: execution blocked.",
    );
  for (const quote of feed.quotes) {
    if (
      quote.history.at(-1)!.price !== quote.price ||
      quote.history.at(-1)!.time !== feed.updatedAt
    )
      throw new Error("Market observation does not match its current quote.");
    if (
      quote.history.some((p, i) => i > 0 && p.time <= quote.history[i - 1].time)
    )
      throw new Error("Market observations must be strictly chronological.");
  }
}
function cents(value: number, label: string, nonnegative = true) {
  if (!Number.isSafeInteger(value) || (nonnegative && value < 0))
    throw new Error(`Account invariant failed: ${label}.`);
}
export function assertAccount(account: Account, uid: string) {
  if (
    account.uid !== uid ||
    account.accountType !== "SIMULATION" ||
    account.currency !== "USD" ||
    account.status !== "ACTIVE"
  )
    throw new Error("Account identity/environment invariant failed.");
  for (const key of [
    "balanceCents",
    "reservedCents",
    "withdrawalHoldCents",
    "startingBalanceCents",
    "ledgerSequence",
    "activitySequence",
    "trades",
    "wins",
    "losses",
  ] as const)
    cents(account[key], key);
  cents(account.totalPnlCents, "totalPnlCents", false);
  cents(account.todayPnlCents, "todayPnlCents", false);
  if (
    account.reservedCents + account.withdrawalHoldCents >
    account.balanceCents
  )
    throw new Error("Reserved funds exceed the simulated balance.");
  if (account.wins + account.losses > account.trades)
    throw new Error("Trade statistics do not reconcile.");
  settingsSchema.parse(account.settings);
}
export function assertSession(session: Session, uid: string, id: string) {
  if (session.userId !== uid || session.id !== id)
    throw new Error("Session identity invariant failed.");
  settingsSchema.parse(session.settings);
  if (session.strategy !== session.settings.strategy)
    throw new Error("Session strategy snapshot does not match.");
  cents(session.startingBalanceCents, "session starting balance");
  cents(session.totalPnlCents, "session P/L", false);
  if (
    !Number.isSafeInteger(session.startedAt) ||
    session.startedAt < 0 ||
    (session.durationSeconds === null
      ? session.expiresAt !== null
      : !Number.isSafeInteger(session.durationSeconds) ||
        session.durationSeconds < 60 ||
        session.expiresAt !==
          session.startedAt + session.durationSeconds * 1000)
  )
    throw new Error("Session deadline invariant failed.");
}
export function assertPositions(
  positions: Trade[],
  account: Account,
  sessionId: string,
) {
  let reserved = 0;
  const markets = new Set<string>();
  for (const p of positions) {
    if (
      p.userId !== account.uid ||
      p.sessionId !== sessionId ||
      p.status !== "OPEN" ||
      p.source !== "SYNTHETIC" ||
      !["BUY", "SELL"].includes(p.side)
    )
      throw new Error("Open position identity/environment invariant failed.");
    if (
      !Number.isSafeInteger(p.amountCents) ||
      p.amountCents <= 0 ||
      ![p.entryPrice, p.quantity, p.stopLoss, p.takeProfit].every(
        (v) => Number.isFinite(v) && v > 0,
      )
    )
      throw new Error("Invalid open position financial values.");
    if (markets.has(p.market))
      throw new Error("Duplicate open position for a market.");
    markets.add(p.market);
    reserved += p.amountCents;
  }
  if (reserved !== account.reservedCents)
    throw new Error("Position collateral does not reconcile with the account.");
}
export function heartbeatFresh(value: unknown, now: number) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value <= now + 5000 &&
    now - value < 30000
  );
}
