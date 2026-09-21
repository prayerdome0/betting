export const SYMBOLS = ["EUR/USD", "GBP/USD", "XAU/USD", "BTC/USD"] as const;
export type SymbolName = (typeof SYMBOLS)[number];
export type Side = "BUY" | "SELL";
export type Settings = {
  strategy: "MOMENTUM" | "MEAN_REVERSION";
  markets: SymbolName[];
  tradeAmountCents: number;
  maxPositions: number;
  stopLossPct: number;
  takeProfitPct: number;
  maxHoldSeconds: number;
  maxSessionLossPct: number;
};
export const DEFAULT_SETTINGS: Settings = {
  strategy: "MOMENTUM",
  markets: [...SYMBOLS],
  tradeAmountCents: 200,
  maxPositions: 2,
  stopLossPct: 0.5,
  takeProfitPct: 0.8,
  maxHoldSeconds: 120,
  maxSessionLossPct: 10,
};
export type Account = {
  uid: string;
  email: string;
  name: string;
  currency: "USD";
  accountType: "SIMULATION";
  status: "ACTIVE";
  balanceCents: number;
  ledgerSequence: number;
  activitySequence: number;
  startingBalanceCents: number;
  reservedCents: number;
  withdrawalHoldCents: number;
  totalPnlCents: number;
  todayPnlCents: number;
  pnlDay: string;
  trades: number;
  wins: number;
  losses: number;
  settings: Settings;
  activeSessionId: string | null;
  createdAt: number;
  updatedAt: number;
};
export type Session = {
  id: string;
  userId: string;
  startedAt: number;
  expiresAt: number | null;
  durationSeconds: number | null;
  status: "ACTIVE" | "PAUSED" | "STOPPING" | "STOPPED" | "COMPLETED";
  aiStatus: string;
  settings: Settings;
  strategy: string;
  startingBalanceCents: number;
  endingBalanceCents: number | null;
  totalPnlCents: number;
  tradesGenerated: number;
  completedAt: number | null;
  lastTickAt: number;
  engineError?: { code: string; occurredAt: number; message: string } | null;
  stopReason: string | null;
};
export type Quote = {
  symbol: SymbolName;
  name: string;
  price: number;
  history: { time: number; price: number }[];
  precision: number;
  changePct: number;
};
export type Feed = { source: "SYNTHETIC"; updatedAt: number; quotes: Quote[] };
export type Trade = {
  id: string;
  userId: string;
  sessionId: string;
  market: SymbolName;
  side: Side;
  amountCents: number;
  entryPrice: number;
  exitPrice: number | null;
  currentPrice: number;
  quantity: number;
  stopLoss: number;
  takeProfit: number;
  startedAt: number;
  endedAt: number | null;
  pnlCents: number;
  feesCents: number;
  status: "OPEN" | "CLOSED";
  result: "WIN" | "LOSS" | "BREAK_EVEN" | null;
  strategyVersion: string;
  aiDecision: Side;
  reason: string;
  closeReason: string | null;
  source: "SYNTHETIC";
};
export type Activity = {
  sequence: number;
  id: string;
  userId: string;
  sessionId: string | null;
  timestamp: number;
  kind: string;
  message: string;
};
export type LedgerEntry = {
  sequence: number;
  id: string;
  userId: string;
  timestamp: number;
  type: string;
  deltaCents: number;
  balanceAfterCents: number;
  referenceId: string;
};
export type Withdrawal = {
  id: string;
  userId: string;
  amountCents: number;
  name: string;
  method: string;
  details: string;
  status: "Submitted" | "Under Review" | "Simulated Completed" | "Cancelled";
  createdAt: number;
  updatedAt: number;
};
