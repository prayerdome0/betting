import type { Quote, Settings, Side, Trade } from "./types";
export const STRATEGY_VERSION = "rules-v1.0";
export const FEE_BPS = 2; // Total round-trip fee on notional. No leverage.
export function analyze(
  quote: Quote,
  strategy: Settings["strategy"],
): { decision: Side | "WAIT"; reason: string; momentum: number } {
  const prices = quote.history.slice(-8).map((p) => p.price);
  if (prices.length < 5)
    return {
      decision: "WAIT",
      reason: "Warming up: collecting at least five market observations.",
      momentum: 0,
    };
  const mean =
    prices.slice(0, -1).reduce((a, b) => a + b, 0) / (prices.length - 1);
  const momentum = (quote.price / mean - 1) * 100;
  const threshold = quote.symbol === "BTC/USD" ? 0.12 : 0.045;
  const reason = `Price is ${momentum.toFixed(3)}% from the recent mean; ${strategy.toLowerCase().replace("_", " ")} threshold is ${threshold}%.`;
  if (Math.abs(momentum) < threshold)
    return { decision: "WAIT", reason, momentum };
  const bullish = strategy === "MOMENTUM" ? momentum > 0 : momentum < 0;
  return { decision: bullish ? "BUY" : "SELL", reason, momentum };
}
export function calculatePnl(
  trade: Pick<Trade, "entryPrice" | "side" | "amountCents">,
  exit: number,
) {
  if (
    !Number.isFinite(exit) ||
    !Number.isFinite(trade.entryPrice) ||
    !(exit > 0) ||
    !(trade.entryPrice > 0)
  )
    throw new Error("Invalid execution price");
  if (
    !Number.isSafeInteger(trade.amountCents) ||
    trade.amountCents <= 0 ||
    !["BUY", "SELL"].includes(trade.side)
  )
    throw new Error("Invalid position allocation or side");
  const feesCents = Math.round((trade.amountCents * FEE_BPS) / 10000);
  const direction = trade.side === "BUY" ? 1 : -1;
  const gross = Math.round(
    trade.amountCents * (exit / trade.entryPrice - 1) * direction,
  );
  if (!Number.isSafeInteger(gross))
    throw new Error("Settlement exceeds safe monetary precision");
  // Fully collateralized simulation: a position can never lose more than its stake.
  return {
    pnlCents: Math.max(-trade.amountCents, gross - feesCents),
    feesCents,
  };
}
export function riskAllows(
  balanceCents: number,
  availableCents: number,
  openCount: number,
  settings: Settings,
) {
  return (
    openCount < settings.maxPositions &&
    settings.tradeAmountCents <= availableCents &&
    settings.tradeAmountCents <= Math.floor(balanceCents * 0.25)
  );
}
export function exitReason(
  trade: Trade,
  price: number,
  now: number,
  settings: Settings,
): string | null {
  if (trade.side === "BUY" ? price <= trade.stopLoss : price >= trade.stopLoss)
    return "STOP_LOSS";
  if (
    trade.side === "BUY" ? price >= trade.takeProfit : price <= trade.takeProfit
  )
    return "TAKE_PROFIT";
  if (now - trade.startedAt >= settings.maxHoldSeconds * 1000)
    return "MAX_HOLD";
  return null;
}
