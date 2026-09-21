export type MarketCategory = "Forex" | "Crypto" | "Commodities";

export type ScannerStatus = "WAIT" | "ANALYZING" | "SIGNAL" | "EXECUTING";

export type TradeSide = "BUY" | "SELL";

export interface Market {
  symbol: string;
  name: string;
  category: MarketCategory;
  price: number;
  prevPrice: number;
  change24h: number;
  high24h: number;
  low24h: number;
  spread: number;
  precision: number;
  history: number[];
  rsi: number;
  macd: { macd: number; signal: number; hist: number };
  trend: "BULLISH" | "BEARISH" | "NEUTRAL";
  scannerStatus: ScannerStatus;
  aiSignal: "BUY" | "SELL" | "WAIT";
  aiScore: number;
  volatility: number;
}

export interface AIReasoning {
  tradeId: string;
  symbol: string;
  side: TradeSide;
  timeframe: string;
  confidence: number;
  strategyModel: string;
  strategyVersion: string;
  indicators: {
    rsi: number;
    emaTrend: string;
    macdStatus: string;
    volatilityAtr: string;
    supportResistance: string;
    orderFlow: string;
  };
  rationale: string;
  stopTargetRationale: string;
  riskRewardRatio: string;
  stopLossPrice: number;
  takeProfitPrice: number;
  timestamp: string;
  latencyMs: number;
}

export interface Position {
  id: string;
  symbol: string;
  name: string;
  side: TradeSide;
  amount: number;
  entryPrice: number;
  currentPrice: number;
  stopLoss: number;
  takeProfit: number;
  pnl: number;
  pnlPercent: number;
  openTime: string;
  status: "MONITORING" | "CLOSING";
  reasoning: AIReasoning;
}

export interface Trade {
  id: string;
  symbol: string;
  name: string;
  side: TradeSide;
  amount: number;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  pnlPercent: number;
  openTime: string;
  closeTime: string;
  duration: string;
  closeReason: "TAKE_PROFIT" | "STOP_LOSS" | "TRAIL_STOP" | "MANUAL_CLOSE";
  isWin: boolean;
  reasoning: AIReasoning;
}

export interface WithdrawalRequest {
  id: string;
  amount: number;
  method: "USDT_TRC20" | "USDT_ERC20" | "BANK_WIRE" | "PAYPAL";
  destination: string;
  status: "PENDING" | "SIMULATED_APPROVED" | "CANCELLED";
  createdAt: string;
  processedAt?: string;
  notes: string;
}

export type StrategyMode = "SCALPING" | "MOMENTUM" | "CONSERVATIVE";

export interface EngineConfig {
  aiEnabled: boolean;
  tradeAmount: number;
  maxOpenTrades: number;
  targetWinRateBenchmark: number; // e.g. 75 or 95 target benchmark
  strategyMode: StrategyMode;
  stopLossPercent: number;
  takeProfitPercent: number;
  tickSpeed: number; // in ms, e.g. 1200
  enabledMarkets: string[];
  soundEnabled: boolean;
}

export interface SystemLog {
  id: string;
  timestamp: string;
  level: "INFO" | "SUCCESS" | "WARNING" | "DANGER" | "AI";
  module: "MARKET_DATA" | "SIGNAL_ENGINE" | "AI_DECISION" | "STRATEGY" | "RISK_ENGINE" | "TRADE_ENGINE" | "SIMULATOR";
  message: string;
  details?: string;
}

export interface AITradeEvent {
  id: string;
  type: "AI_TRADE_OPENED" | "TRADE_CLOSED_WIN" | "TRADE_CLOSED_LOSS";
  asset: string;
  action: TradeSide;
  amount: number;
  entry: number;
  exit?: number;
  result?: number;
  demoBalance: number;
  timestamp: string;
  reasoning?: AIReasoning;
}
