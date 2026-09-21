import { test } from "node:test";
import assert from "node:assert/strict";
import {
  analyze,
  calculatePnl,
  exitReason,
  riskAllows,
} from "../src/lib/trading/strategy";
import {
  DEFAULT_SETTINGS,
  type Quote,
  type Trade,
} from "../src/lib/trading/types";
import { SyntheticMarketProvider } from "../src/lib/server/market";
import { commandSchema } from "../src/lib/server/validation";
import { verifyRequest, ApiError } from "../src/lib/server/firebase";
const quote = (prices: number[]): Quote => ({
  symbol: "EUR/USD",
  name: "Euro",
  price: prices.at(-1)!,
  history: prices.map((price, time) => ({ price, time })),
  precision: 5,
  changePct: 0,
});
test("BUY settlement produces a real 17 cent gain including 2 bps fees", () =>
  assert.deepEqual(
    calculatePnl({ entryPrice: 100, side: "BUY", amountCents: 10000 }, 100.19),
    { pnlCents: 17, feesCents: 2 },
  ));
test("SELL settlement produces an 11 cent loss including fees", () =>
  assert.deepEqual(
    calculatePnl({ entryPrice: 100, side: "SELL", amountCents: 10000 }, 100.09),
    { pnlCents: -11, feesCents: 2 },
  ));
test("BUY and SELL return opposite gross outcomes; neither guarantees profit", () => {
  assert.ok(
    calculatePnl({ entryPrice: 100, side: "BUY", amountCents: 10000 }, 99)
      .pnlCents < 0,
  );
  assert.ok(
    calculatePnl({ entryPrice: 100, side: "SELL", amountCents: 10000 }, 99)
      .pnlCents > 0,
  );
  assert.equal(
    calculatePnl({ entryPrice: 100, side: "BUY", amountCents: 10000 }, 100)
      .pnlCents,
    -2,
  );
});
test("position loss is bounded by fully allocated collateral", () =>
  assert.equal(
    calculatePnl({ entryPrice: 1, side: "SELL", amountCents: 10000 }, 100)
      .pnlCents,
    -10000,
  ));
test("invalid quote prices are rejected", () =>
  assert.throws(() =>
    calculatePnl({ entryPrice: 100, side: "BUY", amountCents: 100 }, 0),
  ));
test("account example is calculated in integer cents, not fabricated", () => {
  let balance = 50000;
  balance += calculatePnl(
    { entryPrice: 100, side: "BUY", amountCents: 10000 },
    100.19,
  ).pnlCents;
  assert.equal(balance, 50017);
  balance += calculatePnl(
    { entryPrice: 100, side: "SELL", amountCents: 10000 },
    100.09,
  ).pnlCents;
  assert.equal(balance, 50006);
});
test("strategy waits for enough observations or insignificant movement", () => {
  assert.equal(analyze(quote([1, 2]), "MOMENTUM").decision, "WAIT");
  assert.equal(analyze(quote([1, 1, 1, 1, 1]), "MOMENTUM").decision, "WAIT");
});
test("momentum and mean reversion are explicit, deterministic, opposing strategies", () => {
  const q = quote([100, 100, 100, 100, 101]);
  assert.equal(analyze(q, "MOMENTUM").decision, "BUY");
  assert.equal(analyze(q, "MEAN_REVERSION").decision, "SELL");
  assert.equal(
    analyze(quote([100, 100, 100, 100, 99]), "MOMENTUM").decision,
    "SELL",
  );
});
test("risk caps enforce available funds, allocation, and max positions", () => {
  const cfg = { ...DEFAULT_SETTINGS, tradeAmountCents: 2500, maxPositions: 2 };
  assert.equal(riskAllows(10000, 5000, 1, cfg), true);
  assert.equal(riskAllows(9999, 5000, 1, cfg), false);
  assert.equal(riskAllows(10000, 2499, 1, cfg), false);
  assert.equal(riskAllows(10000, 5000, 2, cfg), false);
});
test("BUY and SELL stops, targets, and time exits are symmetric", () => {
  const buy = {
    side: "BUY",
    stopLoss: 99,
    takeProfit: 102,
    startedAt: 10000,
  } as Trade;
  assert.equal(exitReason(buy, 99, 10001, DEFAULT_SETTINGS), "STOP_LOSS");
  assert.equal(exitReason(buy, 102, 10001, DEFAULT_SETTINGS), "TAKE_PROFIT");
  assert.equal(exitReason(buy, 100, 130000, DEFAULT_SETTINGS), "MAX_HOLD");
  assert.equal(exitReason(buy, 100, 10001, DEFAULT_SETTINGS), null);
  const sell = { ...buy, side: "SELL", stopLoss: 102, takeProfit: 99 } as Trade;
  assert.equal(exitReason(sell, 102, 10001, DEFAULT_SETTINGS), "STOP_LOSS");
  assert.equal(exitReason(sell, 99, 10001, DEFAULT_SETTINGS), "TAKE_PROFIT");
});
test("synthetic feed is unbiased in direction, replayable, bounded, and explicitly labelled", () => {
  const provider = new SyntheticMarketProvider();
  let feed = provider.next(null, 5000);
  let ups = 0,
    downs = 0;
  assert.deepEqual(feed, provider.next(null, 5000));
  for (let i = 2; i < 250; i++) {
    const prev = feed;
    feed = provider.next(feed, i * 5000);
    if (feed.quotes[0].price > prev.quotes[0].price) ups++;
    else downs++;
  }
  assert.equal(feed.source, "SYNTHETIC");
  assert.equal(feed.quotes[0].history.length, 120);
  assert.ok(ups > 70 && downs > 70);
  assert.ok(feed.quotes.every((q) => q.price > 0));
});
test("server validation rejects malformed money, empty markets, and impossible durations", () => {
  for (const balanceCents of [-1, NaN, Infinity, 10.1, 10000001])
    assert.equal(
      commandSchema.safeParse({ action: "balance", balanceCents }).success,
      false,
    );
  for (const durationSeconds of [0, -1, 59, 1.5, 604801])
    assert.equal(
      commandSchema.safeParse({ action: "start", durationSeconds }).success,
      false,
    );
  assert.equal(
    commandSchema.safeParse({ action: "start", durationSeconds: null }).success,
    true,
  );
  assert.equal(
    commandSchema.safeParse({
      action: "settings",
      name: "Trader",
      settings: { ...DEFAULT_SETTINGS, markets: [] },
    }).success,
    false,
  );
  assert.equal(
    commandSchema.safeParse({
      action: "settings",
      name: "Trader",
      settings: { ...DEFAULT_SETTINGS, markets: ["EUR/USD", "EUR/USD"] },
    }).success,
    false,
  );
});
test("unauthenticated server calls fail before any database access", async () => {
  await assert.rejects(
    verifyRequest(new Request("http://localhost/api/command")),
    (e) => e instanceof ApiError && e.status === 401,
  );
});
