import { AIReasoning, Market, TradeSide } from "@/types/trading";

export function generateAIReasoning(
  market: Market,
  side: TradeSide,
  tradeAmount: number
): AIReasoning {
  const isBuy = side === "BUY";
  const p = market.price;
  const spreadMultiplier = market.price > 100 ? 1 : market.price > 10 ? 0.05 : 0.001;
  const targetPips = isBuy ? p * (1 + 0.0035) : p * (1 - 0.0035);
  const stopPips = isBuy ? p * (1 - 0.0022) : p * (1 + 0.0022);

  const confidence = Math.floor(78 + Math.random() * 16); // 78% to 94% confidence
  const latency = Math.floor(12 + Math.random() * 18); // 12ms - 30ms latency

  const rsi = isBuy
    ? parseFloat((38 + Math.random() * 18).toFixed(1))
    : parseFloat((62 + Math.random() * 18).toFixed(1));

  const emaTrend = isBuy
    ? "EMA(9) crossed above EMA(21) on 5m timeframe with bullish slope"
    : "EMA(9) crossed below EMA(21) on 5m timeframe with downward acceleration";

  const macdStatus = isBuy
    ? "Positive histogram expansion (+0.0024), signal line cross confirmed"
    : "Negative divergence formed on 15m; momentum histogram accelerating down";

  const volatilityAtr = `ATR(14) normalized at ${(market.volatility * 1.2).toFixed(market.precision)} (spread: ${market.spread} pips / 0.008%)`;

  const supportResistance = isBuy
    ? `Liquidity sweep below key S1 support (${(p * 0.998).toFixed(market.precision)}) with immediate buyer absorption`
    : `Institutional supply zone rejection at R1 resistance (${(p * 1.002).toFixed(market.precision)}) with declining volume`;

  const orderFlow = isBuy
    ? "Simulated order book indicates 64% bid-side imbalance with delta spike"
    : "Simulated order book shows 68% ask-side depth; passive sellers holding resistance";

  const rationalesBuy = [
    `Algorithmic engine detected a high-probability liquidity reclaim on ${market.symbol}. Mean-reversion trigger confirmed by RSI oversold divergence and institutional absorption candle.`,
    `Multi-timeframe trend alignment: 15-minute structural breakout confirmed with increasing delta volume. Risk engine approves entry with 1:1.59 reward-to-risk ratio.`,
    `Pattern recognition model matched a 91% similarity with Bullish Flag Continuation setup. Macro currency basket indicates sustained upward momentum.`,
  ];

  const rationalesSell = [
    `Algorithmic engine detected an exhaustion wick at major daily resistance on ${market.symbol}. Bearish pin-bar confirmed with expanding selling pressure.`,
    `Momentum breakdown detected: 5-minute dynamic support breached with heavy sell order flow. Expected mean-reversion target matches lower Bollinger band.`,
    `Distribution block identified by Neural Model v2.8. Overbought RSI conditions coupled with negative MACD histogram divergence offer favorable asymmetric downside.`,
  ];

  const rationale = isBuy
    ? rationalesBuy[Math.floor(Math.random() * rationalesBuy.length)]
    : rationalesSell[Math.floor(Math.random() * rationalesSell.length)];

  const stopTargetRationale = `Dynamic bracket: Stop Loss placed at ${stopPips.toFixed(
    market.precision
  )} (0.22% risk) beyond local swing structure. Take Profit set at ${targetPips.toFixed(
    market.precision
  )} (0.35% reward) targeting next structural liquidity pool.`;

  return {
    tradeId: `AI-${Date.now().toString().slice(-6)}`,
    symbol: market.symbol,
    side,
    timeframe: "M5 / M15 Multi-Timeframe",
    confidence,
    strategyModel: "AlphaTrend Neural Momentum",
    strategyVersion: "v2.8.4-Quant",
    indicators: {
      rsi,
      emaTrend,
      macdStatus,
      volatilityAtr,
      supportResistance,
      orderFlow,
    },
    rationale,
    stopTargetRationale,
    riskRewardRatio: "1:1.59",
    stopLossPrice: parseFloat(stopPips.toFixed(market.precision)),
    takeProfitPrice: parseFloat(targetPips.toFixed(market.precision)),
    timestamp: new Date().toISOString(),
    latencyMs: latency,
  };
}
