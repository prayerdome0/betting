/**
 * Firestore read boundary.
 *
 * Every value the workspace renders comes out of Firestore, and Firestore is a
 * shared, long-lived, schema-less store: documents written by an earlier
 * release, by hand in the console, or by a *different* application configured
 * against the same Firebase project are all valid reads. Trusting them with a
 * bare cast (`s.data() as Account`) means one stale document takes the whole
 * workspace down: an account without `settings` threw
 *
 *   Cannot read properties of undefined (reading 'markets')
 *
 * while the market table rendered, and the route error boundary replaced the
 * dashboard with an apology even though the account and its funds were intact.
 *
 * The readers below turn any stored value into a document the UI can render:
 *
 *   - valid fields are preserved,
 *   - gaps are filled from the documented defaults (`DEFAULT_SETTINGS`) or from
 *     values that can be derived exactly (e.g. `quantity` from
 *     `amountCents`/entry price),
 *   - money, prices, trades and history are **never invented**: a document that
 *     cannot be reconciled without making something up is rejected (`null`)
 *     instead of being displayed as a plausible lie,
 *   - nothing here writes to Firestore. Durable repair of stored documents
 *     happens inside a server transaction (see `lib/server/repair.ts`) and is
 *     recorded in the account activity timeline.
 */

import {
  DEFAULT_SETTINGS,
  SYMBOLS,
  type Account,
  type Activity,
  type Feed,
  type LedgerEntry,
  type Quote,
  type Session,
  type Settings,
  type SymbolName,
  type Trade,
  type Withdrawal,
} from "./types";

export type Row = Record<string, unknown>;

/**
 * Bounds shared with the write-side schema (`lib/server/validation.ts`), so the
 * values this boundary considers acceptable can never drift from the ones the
 * server accepts. A field outside its bounds is treated as missing.
 */
export const SETTINGS_BOUNDS = {
  tradeAmountCents: { min: 100, max: 2_500_000 },
  maxPositions: { min: 1, max: 4 },
  stopLossPct: { min: 0.05, max: 5 },
  takeProfitPct: { min: 0.05, max: 10 },
  maxHoldSeconds: { min: 20, max: 3_600 },
  maxSessionLossPct: { min: 1, max: 25 },
} as const;

const STRATEGIES: Settings["strategy"][] = ["MOMENTUM", "MEAN_REVERSION"];
const SESSION_STATUSES: Session["status"][] = [
  "ACTIVE",
  "PAUSED",
  "STOPPING",
  "STOPPED",
  "COMPLETED",
];
const TRADE_STATUSES: Trade["status"][] = ["OPEN", "CLOSED"];
const TRADE_RESULTS: NonNullable<Trade["result"]>[] = [
  "WIN",
  "LOSS",
  "BREAK_EVEN",
];
const WITHDRAWAL_STATUSES: Withdrawal["status"][] = [
  "Submitted",
  "Under Review",
  "Simulated Completed",
  "Cancelled",
];
const SYMBOL_SET = new Set<string>(SYMBOLS);
/** Fields of a settings object, in the order they are written. */
export const SETTINGS_FIELDS = Object.keys(
  DEFAULT_SETTINGS,
) as (keyof Settings)[];

function row(value: unknown): Row | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Row)
    : null;
}
function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}
function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function positive(value: unknown): number | null {
  const number = finite(value);
  return number !== null && number > 0 ? number : null;
}
function integer(value: unknown): number | null {
  const number = finite(value);
  return number !== null && Number.isSafeInteger(number) ? number : null;
}
function count(value: unknown): number | null {
  const number = integer(value);
  return number !== null && number >= 0 ? number : null;
}
function bounded(value: unknown, bounds: { min: number; max: number }) {
  const number = finite(value);
  return number !== null && number >= bounds.min && number <= bounds.max
    ? number
    : null;
}
function boundedInteger(
  value: unknown,
  bounds: { min: number; max: number },
): number | null {
  const number = integer(value);
  return number !== null && number >= bounds.min && number <= bounds.max
    ? number
    : null;
}
function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | null {
  return typeof value === "string" &&
    (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}
function symbol(value: unknown): SymbolName | null {
  return typeof value === "string" && SYMBOL_SET.has(value)
    ? (value as SymbolName)
    : null;
}
function idOf(data: Row, fallbackId?: string) {
  return text(data.id) ?? text(fallbackId);
}

export type SettingsRead = {
  settings: Settings;
  /** True when every field was already valid: nothing had to be filled in. */
  complete: boolean;
  /** Settings fields that were missing or unusable. */
  missing: string[];
};

/**
 * Reads one settings object, keeping every valid field and filling the rest
 * from `fallback` (documented defaults unless the caller knows better, e.g. the
 * account's settings for a session snapshot).
 */
export function readSettings(
  value: unknown,
  fallback: Settings = DEFAULT_SETTINGS,
): SettingsRead {
  const data = row(value);
  const settings: Settings = {
    ...fallback,
    markets: [...fallback.markets],
  };
  if (!data)
    return { settings, complete: false, missing: [...SETTINGS_FIELDS] };
  const missing: string[] = [];
  const strategy = oneOf(data.strategy, STRATEGIES);
  if (strategy) settings.strategy = strategy;
  else missing.push("strategy");
  const markets = Array.isArray(data.markets)
    ? [...new Set(data.markets.map(symbol).filter((s): s is SymbolName => !!s))]
    : [];
  if (markets.length) settings.markets = markets;
  else missing.push("markets");
  for (const key of [
    "tradeAmountCents",
    "maxPositions",
    "maxHoldSeconds",
  ] as const) {
    const number = boundedInteger(data[key], SETTINGS_BOUNDS[key]);
    if (number !== null) settings[key] = number;
    else missing.push(key);
  }
  for (const key of [
    "stopLossPct",
    "takeProfitPct",
    "maxSessionLossPct",
  ] as const) {
    const number = bounded(data[key], SETTINGS_BOUNDS[key]);
    if (number !== null) settings[key] = number;
    else missing.push(key);
  }
  return { settings, complete: missing.length === 0, missing };
}

/**
 * The account document, or `null` when the document cannot be this
 * application's simulation account. `uid` comes from the document path, which
 * is authoritative — a legacy document may have a stale or missing `uid` field.
 *
 * `balanceCents` is mandatory: displaying a balance the document does not
 * contain would be inventing money. A missing `settings` object, by contrast,
 * is a recoverable gap and is filled from the documented defaults.
 */
export function readAccount(value: unknown, uid: string): Account | null {
  const data = row(value);
  if (!data) return null;
  // Present but contradictory means another writer owns this path.
  if (data.accountType !== undefined && data.accountType !== "SIMULATION")
    return null;
  if (data.currency !== undefined && data.currency !== "USD") return null;
  if (data.status !== undefined && data.status !== "ACTIVE") return null;
  const balanceCents = count(data.balanceCents);
  if (balanceCents === null) return null;
  return {
    uid,
    email: text(data.email) ?? "",
    name: text(data.name) ?? "Trader",
    currency: "USD",
    accountType: "SIMULATION",
    status: "ACTIVE",
    balanceCents,
    ledgerSequence: count(data.ledgerSequence) ?? 0,
    activitySequence: count(data.activitySequence) ?? 0,
    startingBalanceCents: count(data.startingBalanceCents) ?? balanceCents,
    // Both are subtractions from the available balance; a document without them
    // is already refused by the server invariants before anything can move, and
    // "nothing is reserved" is the only reading that does not hide funds.
    reservedCents: count(data.reservedCents) ?? 0,
    withdrawalHoldCents: count(data.withdrawalHoldCents) ?? 0,
    totalPnlCents: integer(data.totalPnlCents) ?? 0,
    todayPnlCents: integer(data.todayPnlCents) ?? 0,
    // A day that never matches means "no realized P/L recorded today".
    pnlDay: text(data.pnlDay) ?? "1970-01-01",
    trades: count(data.trades) ?? 0,
    wins: count(data.wins) ?? 0,
    losses: count(data.losses) ?? 0,
    settings: readSettings(data.settings).settings,
    activeSessionId: text(data.activeSessionId),
    createdAt: count(data.createdAt) ?? 0,
    updatedAt: count(data.updatedAt) ?? 0,
  };
}

/** A session snapshot, or `null` when the document is not a session at all. */
export function readSession(
  value: unknown,
  fallbackId?: string,
): Session | null {
  const data = row(value);
  if (!data) return null;
  const id = idOf(data, fallbackId);
  const status = oneOf(data.status, SESSION_STATUSES);
  const startedAt = count(data.startedAt);
  if (!id || !status || startedAt === null) return null;
  const durationSeconds = count(data.durationSeconds);
  const read = readSettings(data.settings);
  return {
    id,
    userId: text(data.userId) ?? "",
    startedAt,
    // The session invariant is expiresAt === startedAt + durationSeconds*1000,
    // so a bounded deadline can be derived exactly when it was not stored.
    expiresAt:
      durationSeconds === null
        ? null
        : (count(data.expiresAt) ?? startedAt + durationSeconds * 1000),
    durationSeconds,
    status,
    aiStatus: text(data.aiStatus) ?? statusLabel(status),
    settings: read.settings,
    strategy: text(data.strategy) ?? read.settings.strategy,
    startingBalanceCents: count(data.startingBalanceCents) ?? 0,
    endingBalanceCents: count(data.endingBalanceCents),
    totalPnlCents: integer(data.totalPnlCents) ?? 0,
    tradesGenerated: count(data.tradesGenerated) ?? 0,
    completedAt: count(data.completedAt),
    lastTickAt: count(data.lastTickAt) ?? 0,
    engineError: readEngineError(data.engineError),
    stopReason: text(data.stopReason),
  };
}

function statusLabel(status: Session["status"]) {
  if (status === "ACTIVE") return "SCANNING";
  if (status === "PAUSED") return "SESSION PAUSED";
  return status === "COMPLETED" ? "SESSION COMPLETED" : "AI STOPPED";
}

function readEngineError(value: unknown): Session["engineError"] {
  const data = row(value);
  if (!data) return null;
  const code = text(data.code);
  const message = text(data.message);
  if (!code || !message) return null;
  return { code, occurredAt: count(data.occurredAt) ?? 0, message };
}

/**
 * A trade, or `null` when its financial fields are missing. `entryPrice` and
 * `amountCents` decide whether the row means anything; everything else either
 * has an exact derivation or a documented neutral value.
 */
export function readTrade(value: unknown, fallbackId?: string): Trade | null {
  const data = row(value);
  if (!data) return null;
  const id = idOf(data, fallbackId);
  const market = symbol(data.market);
  const side = oneOf(data.side, ["BUY", "SELL"] as const);
  const amountCents = integer(data.amountCents);
  const entryPrice = positive(data.entryPrice);
  const status = oneOf(data.status, TRADE_STATUSES);
  const startedAt = count(data.startedAt);
  if (
    !id ||
    !market ||
    !side ||
    amountCents === null ||
    amountCents <= 0 ||
    entryPrice === null ||
    !status ||
    startedAt === null
  )
    return null;
  return {
    id,
    userId: text(data.userId) ?? "",
    sessionId: text(data.sessionId) ?? "",
    market,
    side,
    amountCents,
    entryPrice,
    exitPrice: positive(data.exitPrice),
    currentPrice: positive(data.currentPrice) ?? entryPrice,
    // Exactly the derivation the execution engine uses; not a guess.
    quantity: positive(data.quantity) ?? amountCents / 100 / entryPrice,
    // 0 means "never recorded"; the detail view prints a dash rather than a
    // level that was not part of the trade.
    stopLoss: positive(data.stopLoss) ?? 0,
    takeProfit: positive(data.takeProfit) ?? 0,
    startedAt,
    endedAt: count(data.endedAt),
    pnlCents: integer(data.pnlCents) ?? 0,
    feesCents: integer(data.feesCents) ?? 0,
    status,
    result: oneOf(data.result, TRADE_RESULTS),
    strategyVersion: text(data.strategyVersion) ?? "unrecorded",
    aiDecision: oneOf(data.aiDecision, ["BUY", "SELL"] as const) ?? side,
    reason: text(data.reason) ?? "",
    closeReason: text(data.closeReason),
    source: "SYNTHETIC",
  };
}

/** One market quote; `null` when its price is missing. */
export function readQuote(value: unknown): Quote | null {
  const data = row(value);
  if (!data) return null;
  const name = symbol(data.symbol);
  const price = positive(data.price);
  if (!name || price === null) return null;
  const history = (Array.isArray(data.history) ? data.history : [])
    .map((point) => {
      const entry = row(point);
      const time = entry ? count(entry.time) : null;
      const value = entry ? positive(entry.price) : null;
      return time !== null && value !== null ? { time, price: value } : null;
    })
    .filter(
      (point): point is { time: number; price: number } => point !== null,
    );
  return {
    symbol: name,
    name: text(data.name) ?? name,
    price,
    history,
    precision: boundedInteger(data.precision, { min: 0, max: 8 }) ?? 2,
    changePct: finite(data.changePct) ?? 0,
  };
}

/** The shared synthetic feed, or `null` when no usable quote is stored. */
export function readFeed(value: unknown): Feed | null {
  const data = row(value);
  if (!data) return null;
  const updatedAt = count(data.updatedAt);
  const quotes = (Array.isArray(data.quotes) ? data.quotes : [])
    .map(readQuote)
    .filter((quote): quote is Quote => quote !== null);
  if (updatedAt === null || !quotes.length) return null;
  return { source: "SYNTHETIC", updatedAt, quotes };
}

/** One activity event. A row without a kind cannot be labelled, so it is dropped. */
export function readActivity(
  value: unknown,
  fallbackId?: string,
): Activity | null {
  const data = row(value);
  if (!data) return null;
  const id = idOf(data, fallbackId);
  const kind = text(data.kind);
  const timestamp = count(data.timestamp);
  if (!id || !kind || timestamp === null) return null;
  return {
    id,
    sequence: count(data.sequence) ?? 0,
    userId: text(data.userId) ?? "",
    sessionId: text(data.sessionId),
    timestamp,
    kind,
    message: text(data.message) ?? "",
  };
}

/** One ledger entry; a row without a balance delta is not a ledger entry. */
export function readLedgerEntry(
  value: unknown,
  fallbackId?: string,
): LedgerEntry | null {
  const data = row(value);
  if (!data) return null;
  const id = idOf(data, fallbackId);
  const type = text(data.type);
  const deltaCents = integer(data.deltaCents);
  const balanceAfterCents = count(data.balanceAfterCents);
  const timestamp = count(data.timestamp);
  if (
    !id ||
    !type ||
    deltaCents === null ||
    balanceAfterCents === null ||
    timestamp === null
  )
    return null;
  return {
    id,
    sequence: count(data.sequence) ?? 0,
    userId: text(data.userId) ?? "",
    timestamp,
    type,
    deltaCents,
    balanceAfterCents,
    referenceId: text(data.referenceId) ?? "",
  };
}

/** One simulated withdrawal request. */
export function readWithdrawal(
  value: unknown,
  fallbackId?: string,
): Withdrawal | null {
  const data = row(value);
  if (!data) return null;
  const id = idOf(data, fallbackId);
  const amountCents = integer(data.amountCents);
  const status = oneOf(data.status, WITHDRAWAL_STATUSES);
  const createdAt = count(data.createdAt);
  if (
    !id ||
    amountCents === null ||
    amountCents <= 0 ||
    !status ||
    createdAt === null
  )
    return null;
  return {
    id,
    userId: text(data.userId) ?? "",
    amountCents,
    name: text(data.name) ?? "",
    method: text(data.method) ?? "",
    details: text(data.details) ?? "",
    status,
    createdAt,
    updatedAt: count(data.updatedAt) ?? createdAt,
  };
}

/** Reads a collection snapshot, dropping rows that cannot be reconciled. */
export function readCollection<T>(
  docs: readonly { id: string; data: () => unknown }[],
  read: (value: unknown, fallbackId: string) => T | null,
): T[] {
  return docs
    .map((snapshot) => read(snapshot.data(), snapshot.id))
    .filter((value): value is T => value !== null);
}
