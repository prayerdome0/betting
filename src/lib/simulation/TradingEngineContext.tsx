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
import { INITIAL_MARKETS } from "@/data/initialMarkets";
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

export function TradingEngineProvider({ children }: { children: ReactNode }) {
  const [balance, setBalance] = useState<number>(500.0);
  const [openPositions, setOpenPositions] = useState<Position[]>([]);
  const [closedTrades, setClosedTrades] = useState<Trade[]>(INITIAL_CLOSED_TRADES);
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>([]);
  const [markets, setMarkets] = useState<Market[]>(INITIAL_MARKETS);
  const [selectedMarket, setSelectedMarket] = useState<Market>(INITIAL_MARKETS[0]);
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([
    {
      id: "log-1",
      timestamp: new Date(Date.now() - 60000).toISOString(),
      level: "INFO",
      module: "SIMULATOR",
      message: "Simulation engine initialized. Demo ledger ready with $500.00 base capital.",
    },
    {
      id: "log-2",
      timestamp: new Date(Date.now() - 45000).toISOString(),
      level: "AI",
      module: "STRATEGY",
      message: "AlphaTrend Quant Engine v2.8 calibrated. Multi-timeframe scanners online.",
    },
    {
      id: "log-3",
      timestamp: new Date(Date.now() - 30000).toISOString(),
      level: "INFO",
      module: "RISK_ENGINE",
      message: "Risk parameters verified. Max open trades: 3. Dynamic stop/target brackets armed.",
    },
  ]);
  const [lastEvent, setLastEvent] = useState<AITradeEvent | null>(null);
  const [selectedReason, setSelectedReason] = useState<AIReasoning | null>(null);
  const [isReasonModalOpen, setIsReasonModalOpen] = useState(false);

  const [config, setConfig] = useState<EngineConfig>({
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
  });

  const lastEventTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load state from localStorage on initial client mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.balance === "number") setBalance(parsed.balance);
        if (Array.isArray(parsed.openPositions)) setOpenPositions(parsed.openPositions);
        if (Array.isArray(parsed.closedTrades)) setClosedTrades(parsed.closedTrades);
        if (Array.isArray(parsed.withdrawalRequests))
          setWithdrawalRequests(parsed.withdrawalRequests);
        if (parsed.config) setConfig((prev) => ({ ...prev, ...parsed.config }));
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

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

  // Available balance is balance minus open positions allocated margin
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

  // Open reason modal
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

  // Execute Simulated AI Trade
  const triggerAiTrade = useCallback(
    (symbol?: string, side?: TradeSide) => {
      // Pick target market
      const candidateMarkets = markets.filter((m) =>
        config.enabledMarkets.includes(m.symbol)
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

      const tradeAmount = config.tradeAmount;

      // Risk check: Available balance must cover tradeAmount
      if (available < tradeAmount) {
        addSystemLog(
          "WARNING",
          "RISK_ENGINE",
          `Order rejected: Insufficient available balance ($${available.toFixed(
            2
          )}) for trade amount $${tradeAmount.toFixed(2)}`
        );
        return;
      }

      // Max open trades check
      if (openPositions.length >= config.maxOpenTrades) {
        addSystemLog(
          "WARNING",
          "RISK_ENGINE",
          `Order rejected: Max open positions limit reached (${openPositions.length}/${config.maxOpenTrades})`
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

      if (config.soundEnabled) {
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
        demoBalance: balance,
        timestamp: new Date().toISOString(),
        reasoning,
      });
    },
    [
      markets,
      config.enabledMarkets,
      config.tradeAmount,
      config.maxOpenTrades,
      config.soundEnabled,
      available,
      openPositions.length,
      balance,
      addSystemLog,
      triggerEvent,
    ]
  );

  // Close Position
  const closePosition = useCallback(
    (positionId: string, reason: Trade["closeReason"] = "MANUAL_CLOSE") => {
      const pos = openPositions.find((p) => p.id === positionId);
      if (!pos) return;

      const isWin = pos.pnl > 0;
      const finalBalance = parseFloat((balance + pos.pnl).toFixed(2));
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

      if (config.soundEnabled) {
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
    [openPositions, balance, config.soundEnabled, addSystemLog, triggerEvent]
  );

  // Fast forward simulated trades (for testing stats & demonstration)
  const fastForwardTrades = useCallback(
    (count: number = 5) => {
      let currentBal = balance;
      const newClosed: Trade[] = [];

      for (let i = 0; i < count; i++) {
        const m = markets[i % markets.length];
        const isWin = Math.random() < 0.72; // ~72% realistic strategy win rate
        const side: TradeSide = Math.random() > 0.4 ? "BUY" : "SELL";
        const amt = config.tradeAmount;
        // Result matching prompt's style: +$0.18 on $1 trade, or proportionally on $10 trade
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
    [balance, markets, config.tradeAmount, addSystemLog]
  );

  // Main simulation heartbeat: price ticks, scanner status rotation, TP/SL monitoring, and AI automated trading
  useEffect(() => {
    const interval = setInterval(() => {
      // 1. Update Market Prices with realistic Brownian motion
      setMarkets((prevMarkets) =>
        prevMarkets.map((market) => {
          const deltaPct = (Math.random() - 0.495) * 0.0016; // slight drift
          const newPriceRaw = market.price * (1 + deltaPct);
          const newPrice = parseFloat(newPriceRaw.toFixed(market.precision));
          const updatedHistory = [...market.history.slice(-14), newPrice];

          // Scanner status cycling for AI demonstration:
          // EUR/USD WAIT, GBP/USD ANALYZING, XAU/USD SIGNAL, BTC/USD EXECUTING
          let nextScanner = market.scannerStatus;
          const r = Math.random();
          if (r < 0.22) {
            const statuses: ScannerStatus[] = [
              "WAIT",
              "ANALYZING",
              "SIGNAL",
              "EXECUTING",
            ];
            const currentIdx = statuses.indexOf(market.scannerStatus);
            nextScanner = statuses[(currentIdx + 1) % statuses.length];
          }

          // Dynamic AI Score & Signal
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
        })
      );
    }, config.tickSpeed);

    return () => clearInterval(interval);
  }, [config.tickSpeed]);

  // Keep selectedMarket in sync with ticked markets
  useEffect(() => {
    const updated = markets.find((m) => m.symbol === selectedMarket.symbol);
    if (updated) {
      setSelectedMarket(updated);
    }
  }, [markets, selectedMarket.symbol]);

  // 2. Position Monitoring Heartbeat (Checks Stop Loss and Take Profit triggers)
  useEffect(() => {
    if (openPositions.length === 0) return;

    setOpenPositions((prevPositions) => {
      const updated: Position[] = [];

      for (const pos of prevPositions) {
        const market = markets.find((m) => m.symbol === pos.symbol);
        if (!market) {
          updated.push(pos);
          continue;
        }

        const currentPrice = market.price;
        const priceDiff =
          pos.side === "BUY"
            ? currentPrice - pos.entryPrice
            : pos.entryPrice - currentPrice;

        // Realistic PnL calculation scaled to trade amount
        // If price moves 0.2%, trade of $10 gains $0.20 * leverage factor (~10x scalping factor)
        const priceMovePct = priceDiff / pos.entryPrice;
        const leverageMultiplier = 90; // simulates institutional CFD/FX scalping tick value
        const rawPnl = pos.amount * priceMovePct * leverageMultiplier;
        const pnl = parseFloat(rawPnl.toFixed(2));
        const pnlPercent = parseFloat(((pnl / pos.amount) * 100).toFixed(1));

        // Check Take Profit or Stop Loss
        const hitTP =
          pos.side === "BUY"
            ? currentPrice >= pos.takeProfit
            : currentPrice <= pos.takeProfit;

        const hitSL =
          pos.side === "BUY"
            ? currentPrice <= pos.stopLoss
            : currentPrice >= pos.stopLoss;

        if (hitTP || hitSL) {
          // Close position on next tick
          setTimeout(() => {
            closePosition(pos.id, hitTP ? "TAKE_PROFIT" : "STOP_LOSS");
          }, 100);
        } else {
          updated.push({
            ...pos,
            currentPrice,
            pnl,
            pnlPercent,
          });
        }
      }

      return updated;
    });
  }, [markets, closePosition, openPositions.length]);

  // 3. AI Autonomous Trader execution loop
  useEffect(() => {
    if (!config.aiEnabled) return;

    // Run AI scanning evaluation every 3.5 seconds
    const aiInterval = setInterval(() => {
      // Check if open trades limit reached
      if (openPositions.length >= config.maxOpenTrades) {
        return;
      }

      // Find an enabled market with an active "SIGNAL" or "EXECUTING" status and high AI score
      const signalMarkets = markets.filter(
        (m) =>
          config.enabledMarkets.includes(m.symbol) &&
          (m.scannerStatus === "SIGNAL" || m.scannerStatus === "EXECUTING") &&
          m.aiScore >= 74
      );

      if (signalMarkets.length > 0) {
        // Pick the highest scoring market
        signalMarkets.sort((a, b) => b.aiScore - a.aiScore);
        const target = signalMarkets[0];

        // Ensure we don't already have an open trade on this exact symbol
        const alreadyOpen = openPositions.some((p) => p.symbol === target.symbol);
        if (!alreadyOpen) {
          triggerAiTrade(
            target.symbol,
            target.aiSignal === "SELL" ? "SELL" : "BUY"
          );
        }
      }
    }, 3200);

    return () => clearInterval(aiInterval);
  }, [
    config.aiEnabled,
    config.maxOpenTrades,
    config.enabledMarkets,
    markets,
    openPositions,
    triggerAiTrade,
  ]);

  // Config actions
  const toggleAiTrading = useCallback(
    (enabled?: boolean) => {
      setConfig((prev) => {
        const next = enabled !== undefined ? enabled : !prev.aiEnabled;
        if (config.soundEnabled) sfx.click();
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
    [config.soundEnabled, addSystemLog]
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
    setSelectedMarket(market);
  }, []);

  // Withdrawal logic (Prototype demo simulation)
  const submitWithdrawal = useCallback(
    (
      amount: number,
      method: WithdrawalRequest["method"],
      destination: string
    ) => {
      if (amount <= 0) {
        return { success: false, message: "Please enter a valid amount greater than $0." };
      }
      if (amount > available) {
        return {
          success: false,
          message: `Insufficient available funds. Current available: $${available.toFixed(2)}`,
        };
      }
      if (!destination || destination.trim().length < 4) {
        return { success: false, message: "Please enter valid payment details." };
      }

      // Deduct from demo balance
      const newBalance = parseFloat((balance - amount).toFixed(2));
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

      if (config.soundEnabled) {
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
    [available, balance, config.soundEnabled, addSystemLog]
  );

  const cancelWithdrawal = useCallback(
    (id: string) => {
      const req = withdrawalRequests.find((r) => r.id === id);
      if (!req || req.status !== "PENDING") return;

      // Restore demo balance
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

  // Dynamic Calculated Statistics
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
