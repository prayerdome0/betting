"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import {
  Market,
  Position,
  Trade,
  WithdrawalRequest,
  EngineConfig,
  SystemLog,
  AITradeEvent,
  AIReasoning,
  TradeSide,
  ScannerStatus,
} from "@/types/trading";
import { INITIAL_MARKETS } from "./initialMarkets";
import { INITIAL_CLOSED_TRADES } from "./initialData";
import { generateAIReasoning } from "./strategy";
import sfx from "@/lib/sound";

interface TradingEngineContextType {
  balance: number;
  available: number;
  openPositions: Position[];
  closedTrades: Trade[];
  withdrawalRequests: WithdrawalRequest[];
  config: EngineConfig;
  markets: Market[];
  systemLogs: SystemLog[];
  lastEvent: AITradeEvent | null;
  selectedReason: AIReasoning | null;
  isReasonModalOpen: boolean;
  selectedMarket: Market;
  // Calculated stats
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  actualWinRate: number;
  netPnL: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  // Actions
  toggleAiTrading: (enabled?: boolean) => void;
  setTradeAmount: (amount: number) => void;
  setMaxOpenTrades: (max: number) => void;
  setTargetWinRateBenchmark: (target: number) => void;
  setStrategyMode: (mode: EngineConfig["strategyMode"]) => void;
  setTickSpeed: (speed: number) => void;
  setSoundEnabled: (enabled: boolean) => void;
  selectMarket: (market: Market) => void;
  closePosition: (positionId: string, reason?: Trade["closeReason"]) => void;
  triggerAiTrade: (symbol?: string, side?: TradeSide) => void;
  fastForwardTrades: (count: number) => void;
  submitWithdrawal: (
    amount: number,
    method: WithdrawalRequest["method"],
    destination: string
  ) => { success: boolean; message: string; request?: WithdrawalRequest };
  cancelWithdrawal: (id: string) => void;
  approveWithdrawal: (id: string) => void;
  resetDemoBalance: () => void;
  openReasonModal: (reason: AIReasoning) => void;
  closeReasonModal: () => void;
  dismissLastEvent: () => void;
  addSystemLog: (
    level: SystemLog["level"],
    module: SystemLog["module"],
    message: string
  ) => void;
}

const TradingEngineContext = createContext<TradingEngineContextType | undefined>(
  undefined
);

const LOCAL_STORAGE_KEY = "nexus_trader_state_v1";

const INITIAL_SYSTEM_LOGS: SystemLog[] = [
  {
    id: "log-1",
    timestamp: "2026-09-21T09:30:00.000Z",
    level: "INFO",
    module: "SIMULATOR",
    message: "Simulation engine initialized. Demo ledger ready with $500.00 base capital.",
  },
  {
    id: "log-2",
    timestamp: "2026-09-21T09:30:15.000Z",
    level: "AI",
    module: "STRATEGY",
    message: "AlphaTrend Quant Engine v2.8 calibrated. Multi-timeframe scanners online.",
  },
  {
    id: "log-3",
    timestamp: "2026-09-21T09:30:30.000Z",
    level: "INFO",
    module: "RISK_ENGINE",
    message: "Risk parameters verified. Max open trades: 3. Dynamic stop/target brackets armed.",
  },
];

const DEFAULT_CONFIG: EngineConfig = {
  aiEnabled: false,
  tradeAmount: 10.0,
  maxOpenTrades: 3,
  targetWinRateBenchmark: 75,
  strategyMode: "SCALPING",
  stopLossPercent: 1.2,
  takeProfitPercent: 2.0,
  tickSpeed: 1400,
  enabledMarkets: INITIAL_MARKETS.map((m) => m.symbol),
  soundEnabled: true,
};

function readStorageKey<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (parsed && key in parsed && parsed[key] !== undefined) {
      return parsed[key] as T;
    }
  } catch {
    // fallback
  }
  return fallback;
}

export function TradingEngineProvider({ children }: { children: ReactNode }) {
  const [balance, setBalance] = useState<number>(() =>
    readStorageKey<number>("balance", 500.0)
  );
  const [openPositions, setOpenPositions] = useState<Position[]>(() =>
    readStorageKey<Position[]>("openPositions", [])
  );
  const [closedTrades, setClosedTrades] = useState<Trade[]>(() =>
    readStorageKey<Trade[]>("closedTrades", INITIAL_CLOSED_TRADES)
  );
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>(
    () => readStorageKey<WithdrawalRequest[]>("withdrawalRequests", [])
  );
  const [config, setConfig] = useState<EngineConfig>(() =>
    readStorageKey<EngineConfig>("config", DEFAULT_CONFIG)
  );

  const [markets, setMarkets] = useState<Market[]>(INITIAL_MARKETS);
  const [selectedSymbol, setSelectedSymbol] = useState<string>(
    INITIAL_MARKETS[0].symbol
  );
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>(INITIAL_SYSTEM_LOGS);
  const [lastEvent, setLastEvent] = useState<AITradeEvent | null>(null);
  const [selectedReason, setSelectedReason] = useState<AIReasoning | null>(null);
  const [isReasonModalOpen, setIsReasonModalOpen] = useState(false);

  const lastEventTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // References to avoid stale closures inside intervals
  const marketsRef = useRef(markets);
  const openPositionsRef = useRef(openPositions);
  const configRef = useRef(config);
  const balanceRef = useRef(balance);

  useEffect(() => {
    marketsRef.current = markets;
    openPositionsRef.current = openPositions;
    configRef.current = config;
    balanceRef.current = balance;
  });

  // Save persistent state
  useEffect(() => {
    try {
      localStorage.setItem(
        LOCAL_STORAGE_KEY,
        JSON.stringify({
          balance,
          openPositions,
          closedTrades,
          withdrawalRequests,
          config,
        })
      );
    } catch {
      // Ignore quota errors
    }
  }, [balance, openPositions, closedTrades, withdrawalRequests, config]);

  // Derived selected market
  const selectedMarket =
    markets.find((m) => m.symbol === selectedSymbol) || markets[0];

  // Available balance
  const allocatedMargin = openPositions.reduce((acc, p) => acc + p.amount, 0);
  const available = Math.max(0, parseFloat((balance - allocatedMargin).toFixed(2)));

  const addSystemLog = useCallback(
    (level: SystemLog["level"], module: SystemLog["module"], message: string) => {
      setSystemLogs((prev) => [
        {
          id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: new Date().toISOString(),
          level,
          module,
          message,
        },
        ...prev.slice(0, 99),
      ]);
    },
    []
  );

  const triggerEvent = useCallback((event: AITradeEvent) => {
    setLastEvent(event);
    if (lastEventTimeoutRef.current) clearTimeout(lastEventTimeoutRef.current);
    lastEventTimeoutRef.current = setTimeout(() => {
      setLastEvent(null);
    }, 7000);
  }, []);

  const openReasonModal = useCallback((reason: AIReasoning) => {
    setSelectedReason(reason);
    setIsReasonModalOpen(true);
  }, []);

  const closeReasonModal = useCallback(() => {
    setIsReasonModalOpen(false);
  }, []);

  const dismissLastEvent = useCallback(() => {
    setLastEvent(null);
  }, []);

  // Close Position function
  const closePosition = useCallback(
    (positionId: string, reason: Trade["closeReason"] = "MANUAL_CLOSE") => {
      const currentPosList = openPositionsRef.current;
      const currentBal = balanceRef.current;
      const cfg = configRef.current;

      const pos = currentPosList.find((p) => p.id === positionId);
      if (!pos) return;

      const isWin = pos.pnl > 0;
      const finalBalance = parseFloat((currentBal + pos.pnl).toFixed(2));
      setBalance(finalBalance);

      const durationMs = Date.now() - new Date(pos.openTime).getTime();
      const mins = Math.floor(durationMs / 60000);
      const secs = Math.floor((durationMs % 60000) / 1000);
      const durationStr = `${mins}m ${secs < 10 ? "0" : ""}${secs}s`;

      const completedTrade: Trade = {
        id: `TR-${Date.now().toString().slice(-6)}`,
        symbol: pos.symbol,
        name: pos.name,
        side: pos.side,
        amount: pos.amount,
        entryPrice: pos.entryPrice,
        exitPrice: pos.currentPrice,
        pnl: parseFloat(pos.pnl.toFixed(2)),
        pnlPercent: parseFloat(pos.pnlPercent.toFixed(2)),
        openTime: pos.openTime,
        closeTime: new Date().toISOString(),
        duration: durationStr,
        closeReason: reason,
        isWin,
        reasoning: pos.reasoning,
      };

      setClosedTrades((prev) => [completedTrade, ...prev]);
      setOpenPositions((prev) => prev.filter((p) => p.id !== positionId));

      if (cfg.soundEnabled) {
        if (isWin) sfx.tradeWin();
        else sfx.tradeLoss();
      }

      addSystemLog(
        isWin ? "SUCCESS" : "DANGER",
        "SIMULATOR",
        `${isWin ? "✅" : "❌"} Trade closed: ${pos.symbol} (${pos.side}) Result: ${
          pos.pnl >= 0 ? "+" : ""
        }$${pos.pnl.toFixed(2)} (${pos.pnlPercent.toFixed(1)}%). Demo Balance: $${finalBalance.toFixed(2)}`
      );

      triggerEvent({
        id: `evt-${Date.now()}`,
        type: isWin ? "TRADE_CLOSED_WIN" : "TRADE_CLOSED_LOSS",
        asset: pos.symbol,
        action: pos.side,
        amount: pos.amount,
        entry: pos.entryPrice,
        exit: pos.currentPrice,
        result: pos.pnl,
        demoBalance: finalBalance,
        timestamp: new Date().toISOString(),
        reasoning: pos.reasoning,
      });
    },
    [addSystemLog, triggerEvent]
  );

  // Trigger Simulated AI Trade
  const triggerAiTrade = useCallback(
    (symbol?: string, side?: TradeSide) => {
      const currentMarkets = marketsRef.current;
      const cfg = configRef.current;
      const currentBal = balanceRef.current;
      const currentPositions = openPositionsRef.current;

      const candidateMarkets = currentMarkets.filter((m) =>
        cfg.enabledMarkets.includes(m.symbol)
      );
      if (candidateMarkets.length === 0) return;

      const market = symbol
        ? candidateMarkets.find((m) => m.symbol === symbol) || candidateMarkets[0]
        : candidateMarkets[Math.floor(Math.random() * candidateMarkets.length)];

      const chosenSide: TradeSide =
        side ||
        (market.aiSignal === "BUY"
          ? "BUY"
          : market.aiSignal === "SELL"
          ? "SELL"
          : Math.random() > 0.45
          ? "BUY"
          : "SELL");

      const tradeAmount = cfg.tradeAmount;
      const marginLocked = currentPositions.reduce((acc, p) => acc + p.amount, 0);
      const curAvailable = Math.max(0, currentBal - marginLocked);

      if (curAvailable < tradeAmount) {
        addSystemLog(
          "WARNING",
          "RISK_ENGINE",
          `Order rejected: Insufficient available balance ($${curAvailable.toFixed(
            2
          )}) for trade size $${tradeAmount.toFixed(2)}`
        );
        return;
      }

      if (currentPositions.length >= cfg.maxOpenTrades) {
        addSystemLog(
          "WARNING",
          "RISK_ENGINE",
          `Order rejected: Max open positions limit reached (${currentPositions.length}/${cfg.maxOpenTrades})`
        );
        return;
      }

      const reasoning = generateAIReasoning(market, chosenSide, tradeAmount);

      const newPosition: Position = {
        id: `POS-${Date.now().toString().slice(-6)}`,
        symbol: market.symbol,
        name: market.name,
        side: chosenSide,
        amount: tradeAmount,
        entryPrice: market.price,
        currentPrice: market.price,
        stopLoss: reasoning.stopLossPrice,
        takeProfit: reasoning.takeProfitPrice,
        pnl: 0,
        pnlPercent: 0,
        openTime: new Date().toISOString(),
        status: "MONITORING",
        reasoning,
      };

      setOpenPositions((prev) => [newPosition, ...prev]);

      if (cfg.soundEnabled) {
        sfx.tradeOpen();
      }

      addSystemLog(
        "AI",
        "TRADE_ENGINE",
        `🤖 AI Trade opened: ${chosenSide} ${market.symbol} @ ${market.price.toFixed(
          market.precision
        )}, Amount: $${tradeAmount.toFixed(2)}, SL: ${reasoning.stopLossPrice}, TP: ${
          reasoning.takeProfitPrice
        }`
      );

      triggerEvent({
        id: `evt-${Date.now()}`,
        type: "AI_TRADE_OPENED",
        asset: market.symbol,
        action: chosenSide,
        amount: tradeAmount,
        entry: market.price,
        demoBalance: currentBal,
        timestamp: new Date().toISOString(),
        reasoning,
      });
    },
    [addSystemLog, triggerEvent]
  );

  // Fast forward simulated trades
  const fastForwardTrades = useCallback(
    (count: number = 5) => {
      let currentBal = balanceRef.current;
      const currentMarkets = marketsRef.current;
      const cfg = configRef.current;
      const newClosed: Trade[] = [];

      for (let i = 0; i < count; i++) {
        const m = currentMarkets[i % currentMarkets.length];
        const isWin = Math.random() < 0.72; // ~72% realistic win rate
        const side: TradeSide = Math.random() > 0.4 ? "BUY" : "SELL";
        const amt = cfg.tradeAmount;
        const ratio = amt / 1.0;
        const pnl = isWin
          ? parseFloat(((0.14 + Math.random() * 0.12) * ratio).toFixed(2))
          : parseFloat((-(0.09 + Math.random() * 0.08) * ratio).toFixed(2));
        const pnlPercent = parseFloat(((pnl / amt) * 100).toFixed(1));

        currentBal = parseFloat((currentBal + pnl).toFixed(2));

        const entry = m.price;
        const exit =
          side === "BUY"
            ? entry * (1 + (pnlPercent / 100) * 0.01)
            : entry * (1 - (pnlPercent / 100) * 0.01);

        const reasoning = generateAIReasoning(m, side, amt);

        newClosed.unshift({
          id: `TR-FF-${Date.now().toString().slice(-4)}-${i}`,
          symbol: m.symbol,
          name: m.name,
          side,
          amount: amt,
          entryPrice: parseFloat(entry.toFixed(m.precision)),
          exitPrice: parseFloat(exit.toFixed(m.precision)),
          pnl,
          pnlPercent,
          openTime: new Date(Date.now() - (i + 1) * 70000).toISOString(),
          closeTime: new Date(Date.now() - (i * 70000 + 10000)).toISOString(),
          duration: "4m 12s",
          closeReason: isWin ? "TAKE_PROFIT" : "STOP_LOSS",
          isWin,
          reasoning,
        });
      }

      setBalance(currentBal);
      setClosedTrades((prev) => [...newClosed, ...prev]);

      addSystemLog(
        "INFO",
        "SIMULATOR",
        `Generated ${count} simulated trades. Current demo balance: $${currentBal.toFixed(2)}`
      );
    },
    [addSystemLog]
  );

  // Main simulation heartbeat: price ticks, scanner status rotation, and position monitoring inside timer
  useEffect(() => {
    const interval = setInterval(() => {
      // 1. Calculate updated markets
      const nextMarkets = marketsRef.current.map((market) => {
        const deltaPct = (Math.random() - 0.495) * 0.0016;
        const newPriceRaw = market.price * (1 + deltaPct);
        const newPrice = parseFloat(newPriceRaw.toFixed(market.precision));
        const updatedHistory = [...market.history.slice(-14), newPrice];

        let nextScanner = market.scannerStatus;
        if (Math.random() < 0.22) {
          const statuses: ScannerStatus[] = [
            "WAIT",
            "ANALYZING",
            "SIGNAL",
            "EXECUTING",
          ];
          const currentIdx = statuses.indexOf(market.scannerStatus);
          nextScanner = statuses[(currentIdx + 1) % statuses.length];
        }

        const aiScore = Math.min(
          96,
          Math.max(45, Math.floor(market.aiScore + (Math.random() * 4 - 2)))
        );
        const aiSignal =
          aiScore > 75
            ? market.change24h >= 0
              ? "BUY"
              : "SELL"
            : aiScore < 55
            ? "WAIT"
            : market.aiSignal;

        return {
          ...market,
          prevPrice: market.price,
          price: newPrice,
          change24h: parseFloat(
            (
              market.change24h +
              (newPrice > market.price ? 0.01 : -0.01)
            ).toFixed(2)
          ),
          high24h: Math.max(market.high24h, newPrice),
          low24h: Math.min(market.low24h, newPrice),
          history: updatedHistory,
          scannerStatus: nextScanner,
          aiScore,
          aiSignal,
        };
      });

      setMarkets(nextMarkets);

      // 2. Monitor open positions against updated market prices
      const currentPositions = openPositionsRef.current;
      if (currentPositions.length > 0) {
        const positionsToClose: { id: string; reason: Trade["closeReason"] }[] = [];

        setOpenPositions((prev) => {
          return prev.map((pos) => {
            const m = nextMarkets.find((item) => item.symbol === pos.symbol);
            if (!m) return pos;

            const currentPrice = m.price;
            const priceDiff =
              pos.side === "BUY"
                ? currentPrice - pos.entryPrice
                : pos.entryPrice - currentPrice;

            const priceMovePct = priceDiff / pos.entryPrice;
            const leverageMultiplier = 90;
            const rawPnl = pos.amount * priceMovePct * leverageMultiplier;
            const pnl = parseFloat(rawPnl.toFixed(2));
            const pnlPercent = parseFloat(((pnl / pos.amount) * 100).toFixed(1));

            const hitTP =
              pos.side === "BUY"
                ? currentPrice >= pos.takeProfit
                : currentPrice <= pos.takeProfit;

            const hitSL =
              pos.side === "BUY"
                ? currentPrice <= pos.stopLoss
                : currentPrice >= pos.stopLoss;

            if (hitTP || hitSL) {
              positionsToClose.push({
                id: pos.id,
                reason: hitTP ? "TAKE_PROFIT" : "STOP_LOSS",
              });
            }

            return {
              ...pos,
              currentPrice,
              pnl,
              pnlPercent,
            };
          });
        });

        // Trigger exits outside of the reducer
        if (positionsToClose.length > 0) {
          positionsToClose.forEach(({ id, reason }) => {
            closePosition(id, reason);
          });
        }
      }
    }, config.tickSpeed);

    return () => clearInterval(interval);
  }, [config.tickSpeed, closePosition]);

  // AI Autonomous Trader execution loop
  useEffect(() => {
    if (!config.aiEnabled) return;

    const aiInterval = setInterval(() => {
      const curPositions = openPositionsRef.current;
      const cfg = configRef.current;
      const curMarkets = marketsRef.current;

      if (curPositions.length >= cfg.maxOpenTrades) {
        return;
      }

      const signalMarkets = curMarkets.filter(
        (m) =>
          cfg.enabledMarkets.includes(m.symbol) &&
          (m.scannerStatus === "SIGNAL" || m.scannerStatus === "EXECUTING") &&
          m.aiScore >= 74
      );

      if (signalMarkets.length > 0) {
        signalMarkets.sort((a, b) => b.aiScore - a.aiScore);
        const target = signalMarkets[0];

        const alreadyOpen = curPositions.some((p) => p.symbol === target.symbol);
        if (!alreadyOpen) {
          triggerAiTrade(
            target.symbol,
            target.aiSignal === "SELL" ? "SELL" : "BUY"
          );
        }
      }
    }, 3200);

    return () => clearInterval(aiInterval);
  }, [config.aiEnabled, triggerAiTrade]);

  // Config actions
  const toggleAiTrading = useCallback(
    (enabled?: boolean) => {
      setConfig((prev) => {
        const next = enabled !== undefined ? enabled : !prev.aiEnabled;
        if (configRef.current.soundEnabled) sfx.click();
        addSystemLog(
          "AI",
          "AI_DECISION",
          next
            ? `🟢 AI Autonomous Trading ACTIVATED. Monitoring ${prev.enabledMarkets.length} markets. Trade size: $${prev.tradeAmount.toFixed(2)}`
            : "⚪ AI Autonomous Trading PAUSED. All automated order placement halted."
        );
        return { ...prev, aiEnabled: next };
      });
    },
    [addSystemLog]
  );

  const setTradeAmount = useCallback((amount: number) => {
    setConfig((prev) => ({ ...prev, tradeAmount: Math.max(1, amount) }));
  }, []);

  const setMaxOpenTrades = useCallback((max: number) => {
    setConfig((prev) => ({ ...prev, maxOpenTrades: Math.max(1, Math.min(10, max)) }));
  }, []);

  const setTargetWinRateBenchmark = useCallback((target: number) => {
    setConfig((prev) => ({
      ...prev,
      targetWinRateBenchmark: Math.max(50, Math.min(99, target)),
    }));
  }, []);

  const setStrategyMode = useCallback((mode: EngineConfig["strategyMode"]) => {
    setConfig((prev) => ({ ...prev, strategyMode: mode }));
  }, []);

  const setTickSpeed = useCallback((speed: number) => {
    setConfig((prev) => ({ ...prev, tickSpeed: speed }));
  }, []);

  const setSoundEnabled = useCallback((enabled: boolean) => {
    setConfig((prev) => ({ ...prev, soundEnabled: enabled }));
  }, []);

  const selectMarket = useCallback((market: Market) => {
    setSelectedSymbol(market.symbol);
  }, []);

  // Withdrawal logic
  const submitWithdrawal = useCallback(
    (
      amount: number,
      method: WithdrawalRequest["method"],
      destination: string
    ) => {
      const curAvailable = available;
      const curBalance = balanceRef.current;
      const cfg = configRef.current;

      if (amount <= 0) {
        return { success: false, message: "Please enter a valid amount greater than $0." };
      }
      if (amount > curAvailable) {
        return {
          success: false,
          message: `Insufficient available funds. Current available: $${curAvailable.toFixed(2)}`,
        };
      }
      if (!destination || destination.trim().length < 4) {
        return { success: false, message: "Please enter valid payment details." };
      }

      const newBalance = parseFloat((curBalance - amount).toFixed(2));
      setBalance(newBalance);

      const request: WithdrawalRequest = {
        id: `WD-${Math.floor(10000 + Math.random() * 90000)}`,
        amount: parseFloat(amount.toFixed(2)),
        method,
        destination: destination.trim(),
        status: "PENDING",
        createdAt: new Date().toISOString(),
        notes: "Simulated prototype withdrawal — recorded in demo ledger.",
      };

      setWithdrawalRequests((prev) => [request, ...prev]);

      if (cfg.soundEnabled) {
        sfx.cashout();
      }

      addSystemLog(
        "INFO",
        "SIMULATOR",
        `Withdrawal request recorded: $${amount.toFixed(
          2
        )} via ${method}. Status: PENDING (Prototype demo ledger)`
      );

      return {
        success: true,
        message: "Withdrawal Request Received. Your request has been recorded.",
        request,
      };
    },
    [available, addSystemLog]
  );

  const cancelWithdrawal = useCallback(
    (id: string) => {
      const req = withdrawalRequests.find((r) => r.id === id);
      if (!req || req.status !== "PENDING") return;

      setBalance((prev) => parseFloat((prev + req.amount).toFixed(2)));
      setWithdrawalRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: "CANCELLED" } : r))
      );

      addSystemLog(
        "INFO",
        "SIMULATOR",
        `Withdrawal ${id} cancelled. $${req.amount.toFixed(
          2
        )} returned to demo balance.`
      );
    },
    [withdrawalRequests, addSystemLog]
  );

  const approveWithdrawal = useCallback(
    (id: string) => {
      setWithdrawalRequests((prev) =>
        prev.map((r) =>
          r.id === id
            ? {
                ...r,
                status: "SIMULATED_APPROVED",
                processedAt: new Date().toISOString(),
              }
            : r
        )
      );

      addSystemLog(
        "SUCCESS",
        "SIMULATOR",
        `Withdrawal ${id} marked as SIMULATED APPROVED. Prototype demonstration complete.`
      );
    },
    [addSystemLog]
  );

  const resetDemoBalance = useCallback(() => {
    setBalance(500.0);
    setOpenPositions([]);
    setClosedTrades(INITIAL_CLOSED_TRADES);
    setWithdrawalRequests([]);
    addSystemLog(
      "WARNING",
      "SIMULATOR",
      "Demo balance and ledger reset to original $500.00 baseline."
    );
  }, [addSystemLog]);

  // Statistics
  const totalTrades = closedTrades.length;
  const winningTrades = closedTrades.filter((t) => t.isWin).length;
  const losingTrades = closedTrades.filter((t) => !t.isWin).length;
  const actualWinRate =
    totalTrades > 0
      ? parseFloat(((winningTrades / totalTrades) * 100).toFixed(1))
      : 0;

  const grossProfit = parseFloat(
    closedTrades
      .filter((t) => t.pnl > 0)
      .reduce((acc, t) => acc + t.pnl, 0)
      .toFixed(2)
  );

  const grossLoss = parseFloat(
    Math.abs(
      closedTrades
        .filter((t) => t.pnl < 0)
        .reduce((acc, t) => acc + t.pnl, 0)
    ).toFixed(2)
  );

  const netPnL = parseFloat(
    closedTrades.reduce((acc, t) => acc + t.pnl, 0).toFixed(2)
  );

  const profitFactor =
    grossLoss > 0
      ? parseFloat((grossProfit / grossLoss).toFixed(2))
      : grossProfit > 0
      ? 9.99
      : 1.0;

  const avgWin =
    winningTrades > 0 ? parseFloat((grossProfit / winningTrades).toFixed(2)) : 0;
  const avgLoss =
    losingTrades > 0 ? parseFloat((grossLoss / losingTrades).toFixed(2)) : 0;

  return (
    <TradingEngineContext.Provider
      value={{
        balance,
        available,
        openPositions,
        closedTrades,
        withdrawalRequests,
        config,
        markets,
        systemLogs,
        lastEvent,
        selectedReason,
        isReasonModalOpen,
        selectedMarket,
        totalTrades,
        winningTrades,
        losingTrades,
        actualWinRate,
        netPnL,
        grossProfit,
        grossLoss,
        profitFactor,
        avgWin,
        avgLoss,
        toggleAiTrading,
        setTradeAmount,
        setMaxOpenTrades,
        setTargetWinRateBenchmark,
        setStrategyMode,
        setTickSpeed,
        setSoundEnabled,
        selectMarket,
        closePosition,
        triggerAiTrade,
        fastForwardTrades,
        submitWithdrawal,
        cancelWithdrawal,
        approveWithdrawal,
        resetDemoBalance,
        openReasonModal,
        closeReasonModal,
        dismissLastEvent,
        addSystemLog,
      }}
    >
      {children}
    </TradingEngineContext.Provider>
  );
}

export function useTradingEngine() {
  const context = useContext(TradingEngineContext);
  if (!context) {
    throw new Error(
      "useTradingEngine must be used within a TradingEngineProvider"
    );
  }
  return context;
}
