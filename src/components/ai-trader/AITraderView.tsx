"use client";

import React, { useState } from "react";
import { useTradingEngine } from "@/lib/simulation/TradingEngineContext";
import {
  Bot,
  Zap,
  Activity,
  Sliders,
  Eye,
  CheckCircle2,
  XCircle,
  Play,
  Square,
  Sparkles,
  ShieldAlert,
  HelpCircle,
  TrendingUp,
  TrendingDown,
  Layers,
  ArrowRight,
  Target,
  Clock,
  Radio,
} from "lucide-react";

export default function AITraderView() {
  const {
    balance,
    available,
    config,
    toggleAiTrading,
    setTradeAmount,
    setMaxOpenTrades,
    markets,
    openPositions,
    closedTrades,
    openReasonModal,
    triggerAiTrade,
    closePosition,
    addSystemLog,
  } = useTradingEngine();

  const [activeTab, setActiveTab] = useState<"SCANNER" | "ACTIVE_TRADES" | "LOGS">("SCANNER");

  return (
    <div className="space-y-6">
      {/* Top Status & Controls Bar matching prompt section 3 */}
      <div className="rounded-2xl bg-gradient-to-r from-[#0d1e1a] via-[#0a1714] to-[#0d1e1a] border border-[#1b3f35] p-6 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              {/* AI TRADING: ACTIVE or OFF badge */}
              <div
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-black tracking-wider uppercase border shadow-md ${
                  config.aiEnabled
                    ? "bg-[#143d31] text-[#22d3a0] border-[#22d3a0]/40 shadow-[#22d3a0]/20"
                    : "bg-[#1f2624] text-[#708a83] border-[#2c3734]"
                }`}
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    config.aiEnabled
                      ? "bg-[#22d3a0] animate-pulse"
                      : "bg-[#5b6e68]"
                  }`}
                />
                <span>AI TRADING: {config.aiEnabled ? "🟢 ACTIVE" : "⚪ OFF"}</span>
              </div>

              {/* Amount per trade badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0c1815] border border-[#1b352e] text-xs font-semibold text-[#8eb0a6]">
                <span>Amount per trade:</span>
                <span className="font-bold text-[#eef6f4] font-mono">
                  ${config.tradeAmount.toFixed(2)}
                </span>
              </div>

              {/* Maximum open trades badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0c1815] border border-[#1b352e] text-xs font-semibold text-[#8eb0a6]">
                <span>Maximum open trades:</span>
                <span className="font-bold text-[#22d3a0] font-mono">
                  {config.maxOpenTrades}
                </span>
              </div>
            </div>

            {/* AI Status line matching prompt: "AI STATUS: Scanning markets..." */}
            <div className="flex items-center gap-2 pt-1">
              <Radio className={`w-4 h-4 ${config.aiEnabled ? "text-[#22d3a0] animate-spin" : "text-[#5b6e68]"}`} />
              <span className="text-xs text-[#6e8e86] font-medium">
                AI STATUS:
              </span>
              <span
                className={`text-xs font-bold font-mono ${
                  config.aiEnabled ? "text-[#34e3b1]" : "text-[#829e97]"
                }`}
              >
                {config.aiEnabled
                  ? "Scanning markets & calculating high-probability entries..."
                  : "Standby mode. Autonomous order dispatch paused."}
              </span>
            </div>
          </div>

          {/* Quick Configs & Main Action Toggle */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Trade Size Selector */}
            <div className="bg-[#0b1815] border border-[#19362e] rounded-xl p-1.5 flex items-center gap-1">
              <span className="text-[11px] text-[#6b8b83] font-semibold px-2">
                Size:
              </span>
              {[1, 2, 5, 10].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setTradeAmount(amt)}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                    config.tradeAmount === amt
                      ? "bg-[#184638] text-[#34e3b1] border border-[#276a56]"
                      : "text-[#62827a] hover:bg-[#122621]"
                  }`}
                >
                  ${amt}
                </button>
              ))}
            </div>

            {/* Max Open Trades Selector */}
            <div className="bg-[#0b1815] border border-[#19362e] rounded-xl p-1.5 flex items-center gap-1">
              <span className="text-[11px] text-[#6b8b83] font-semibold px-2">
                Max Trades:
              </span>
              {[1, 2, 3, 5].map((count) => (
                <button
                  key={count}
                  onClick={() => setMaxOpenTrades(count)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                    config.maxOpenTrades === count
                      ? "bg-[#184638] text-[#34e3b1] border border-[#276a56]"
                      : "text-[#62827a] hover:bg-[#122621]"
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>

            {/* START / STOP Button */}
            <button
              onClick={() => toggleAiTrading()}
              className={`px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg transition-all transform active:scale-95 ${
                config.aiEnabled
                  ? "bg-[#2f1418] hover:bg-[#3d191e] text-[#ff6470] border border-[#6b252c]"
                  : "bg-gradient-to-r from-[#179672] to-[#22d3a0] hover:from-[#1bb288] hover:to-[#38e8b6] text-[#051a14] font-black border border-[#38e8b6]/40 shadow-[#22d3a0]/20"
              }`}
            >
              {config.aiEnabled ? (
                <>
                  <Square className="w-4 h-4 fill-current" />
                  <span>STOP AI TRADING</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>START AI TRADING</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Prototype Notice */}
        <div className="mt-4 pt-3 border-t border-[#142d27] flex items-center justify-between text-[11px] text-[#55776f]">
          <span>
            ℹ️ <strong className="text-[#89ada3]">No manual BUY/SELL:</strong> In AI mode, the quantitative engine handles orders autonomously.
          </span>
          <button
            onClick={() => triggerAiTrade()}
            className="text-[#22d3a0] hover:underline font-semibold flex items-center gap-1"
          >
            <Sparkles className="w-3 h-3" /> Simulate Instant Signal
          </button>
        </div>
      </div>

      {/* When the strategy produces a simulated trade banner - matching Section 3:
          🤖 AI ACTION
          SELL XAU/USD
          Amount: $1
          Stop: configured
          Target: configured
          [VIEW REASON]
      */}
      {openPositions.length > 0 && (
        <div className="rounded-xl bg-gradient-to-r from-[#0d221c] via-[#0f2821] to-[#0c1f19] border border-[#235848] p-5 shadow-lg animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#143a2f] border border-[#235e4d] flex items-center justify-center text-xl">
                🤖
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black tracking-wider text-[#22d3a0] uppercase">
                    AI ACTION IN PROGRESS
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-[#16362e] text-[#4ee4b8] font-mono">
                    AUTONOMOUS EXECUTION
                  </span>
                </div>
                <div className="text-base font-bold text-[#eef6f4] flex items-center gap-2 mt-0.5">
                  <span>
                    {openPositions[0].side} {openPositions[0].symbol}
                  </span>
                  <span className="text-xs text-[#71968d] font-normal">
                    · Amount: ${openPositions[0].amount.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="text-xs space-y-0.5 font-mono">
                <div className="text-[#72968e]">
                  Stop:{" "}
                  <span className="text-[#ff7884] font-bold">
                    {openPositions[0].stopLoss}
                  </span>
                </div>
                <div className="text-[#72968e]">
                  Target:{" "}
                  <span className="text-[#22d3a0] font-bold">
                    {openPositions[0].takeProfit}
                  </span>
                </div>
              </div>

              <div className="text-right">
                <div
                  className={`text-sm font-black font-mono ${
                    openPositions[0].pnl >= 0 ? "text-[#22d3a0]" : "text-[#ff6470]"
                  }`}
                >
                  {openPositions[0].pnl >= 0 ? "+" : ""}
                  ${openPositions[0].pnl.toFixed(2)}
                </div>
                <div className="text-[10px] text-[#55756d]">
                  {openPositions[0].pnlPercent >= 0 ? "+" : ""}
                  {openPositions[0].pnlPercent.toFixed(1)}%
                </div>
              </div>

              <button
                onClick={() => openReasonModal(openPositions[0].reasoning)}
                className="px-4 py-2 rounded-lg bg-[#184638] hover:bg-[#205747] text-[#22d3a0] text-xs font-bold transition-all flex items-center gap-1.5 shadow-md border border-[#276855]"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>[VIEW REASON]</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Scanner Matrix - Exactly matches Prompt Section 3:
          EUR/USD WAIT
          GBP/USD ANALYZING
          XAU/USD SIGNAL
      */}
      <div className="rounded-xl bg-[#091518] border border-[#17302b] shadow-xl overflow-hidden">
        {/* Table Header */}
        <div className="p-5 border-b border-[#16332c] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0c1a17]">
          <div>
            <h3 className="text-base font-bold text-[#eef6f4] flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#22d3a0]" />
              Real-Time Market Scanner Matrix
            </h3>
            <p className="text-xs text-[#6e8e86] mt-0.5">
              Multi-asset algorithmic state machine (WAIT → ANALYZING → SIGNAL → EXECUTING)
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded bg-[#132c25] text-[#22d3a0] font-mono font-semibold">
              {markets.length} pairs scanned
            </span>
          </div>
        </div>

        {/* Market Scanner Rows */}
        <div className="divide-y divide-[#152e28] text-sm">
          {markets.map((m) => {
            const isSignal = m.scannerStatus === "SIGNAL";
            const isAnalyzing = m.scannerStatus === "ANALYZING";
            const isWait = m.scannerStatus === "WAIT";
            const isExecuting = m.scannerStatus === "EXECUTING";

            return (
              <div
                key={m.symbol}
                className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-[#0c1a17] transition-colors"
              >
                {/* Asset info */}
                <div className="flex items-center gap-3 min-w-[200px]">
                  <div className="w-9 h-9 rounded-lg bg-[#122e26] text-[#22d3a0] flex items-center justify-center font-black text-xs">
                    {m.symbol.slice(0, 2)}
                  </div>
                  <div>
                    <div className="font-bold text-[#eef6f4] flex items-center gap-2">
                      <span>{m.symbol}</span>
                      <span className="text-[10px] text-[#55756d] font-normal uppercase">
                        {m.category}
                      </span>
                    </div>
                    <div className="text-xs text-[#6e8e86] font-mono">
                      {m.name}
                    </div>
                  </div>
                </div>

                {/* Price & 24h Change */}
                <div className="flex items-center gap-6 min-w-[160px]">
                  <div>
                    <div className="text-sm font-bold font-mono text-[#eef6f4]">
                      {m.price.toFixed(m.precision)}
                    </div>
                    <div className="text-[10px] text-[#55756d]">
                      Spread: {m.spread} pips
                    </div>
                  </div>
                  <div>
                    <span
                      className={`text-xs font-mono font-bold flex items-center ${
                        m.change24h >= 0 ? "text-[#22d3a0]" : "text-[#ff6470]"
                      }`}
                    >
                      {m.change24h >= 0 ? "+" : ""}
                      {m.change24h}%
                    </span>
                    <div className="text-[10px] text-[#55756d]">24H</div>
                  </div>
                </div>

                {/* AI Score & Confidence */}
                <div className="min-w-[140px] space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#6e8e86]">Signal Score</span>
                    <span className="font-mono font-bold text-[#22d3a0]">
                      {m.aiScore}/100
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-[#142622] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        m.aiScore > 75
                          ? "bg-[#22d3a0]"
                          : m.aiScore > 60
                          ? "bg-[#38bdf8]"
                          : "bg-[#eab308]"
                      }`}
                      style={{ width: `${m.aiScore}%` }}
                    />
                  </div>
                </div>

                {/* Scanner Status Badge - The exact prompt items: EUR/USD WAIT, GBP/USD ANALYZING, XAU/USD SIGNAL */}
                <div className="flex items-center justify-between md:justify-end gap-3 min-w-[180px]">
                  <span
                    className={`px-3.5 py-1 rounded-md text-xs font-black tracking-wider uppercase font-mono ${
                      isWait
                        ? "bg-[#21231d] text-[#eab308] border border-[#524419]"
                        : isAnalyzing
                        ? "bg-[#112735] text-[#38bdf8] border border-[#194c6e]"
                        : isSignal
                        ? "bg-[#133c2e] text-[#22d3a0] border border-[#24755a] animate-pulse"
                        : "bg-[#381c30] text-[#f472b6] border border-[#752661]"
                    }`}
                  >
                    {m.scannerStatus}
                  </span>

                  {/* Manual trigger button for instant prototype demonstration */}
                  <button
                    onClick={() =>
                      triggerAiTrade(
                        m.symbol,
                        m.aiSignal === "SELL" ? "SELL" : "BUY"
                      )
                    }
                    className="px-2.5 py-1 rounded bg-[#122822] hover:bg-[#1a3830] text-[#789d93] hover:text-[#22d3a0] text-xs font-semibold transition-colors"
                    title={`Simulate trade on ${m.symbol}`}
                  >
                    Trigger Trade
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Monitored Positions Detailed Table */}
      <div className="rounded-xl bg-[#091518] border border-[#17302b] shadow-xl overflow-hidden">
        <div className="p-5 border-b border-[#16332c] flex items-center justify-between bg-[#0c1a17]">
          <div>
            <h3 className="text-base font-bold text-[#eef6f4] flex items-center gap-2">
              <Target className="w-4 h-4 text-[#22d3a0]" />
              Simulated Positions Monitoring
            </h3>
            <p className="text-xs text-[#6e8e86] mt-0.5">
              Live brackets ticking with dynamic Stop Loss and Take Profit
            </p>
          </div>
          <span className="text-xs text-[#709087] font-mono">
            {openPositions.length} active of {config.maxOpenTrades} allowed
          </span>
        </div>

        {openPositions.length === 0 ? (
          <div className="p-10 text-center text-[#6e8e86]">
            <p className="text-sm">No open positions currently running.</p>
            <p className="text-xs text-[#52746b] mt-1">
              When AI is ACTIVE, trades are opened automatically whenever an asset generates a SIGNAL.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0b1715] text-[#6b8b83] font-bold border-b border-[#16332c]">
                <tr>
                  <th className="p-3.5 pl-5">POSITION</th>
                  <th className="p-3.5">SIDE</th>
                  <th className="p-3.5">AMOUNT</th>
                  <th className="p-3.5">ENTRY PRICE</th>
                  <th className="p-3.5">CURRENT PRICE</th>
                  <th className="p-3.5">STOP LOSS</th>
                  <th className="p-3.5">TAKE PROFIT</th>
                  <th className="p-3.5">UNREALIZED P/L</th>
                  <th className="p-3.5 pr-5 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#152e28]">
                {openPositions.map((pos) => {
                  const isBuy = pos.side === "BUY";
                  return (
                    <tr key={pos.id} className="hover:bg-[#0c1a17]">
                      <td className="p-3.5 pl-5 font-bold text-[#eef6f4] font-mono">
                        {pos.symbol}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                            isBuy
                              ? "bg-[#143d31] text-[#22d3a0]"
                              : "bg-[#3e191d] text-[#ff6470]"
                          }`}
                        >
                          {pos.side}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono text-[#c6ded8]">
                        ${pos.amount.toFixed(2)}
                      </td>
                      <td className="p-3.5 font-mono text-[#c6ded8]">
                        {pos.entryPrice}
                      </td>
                      <td className="p-3.5 font-mono text-[#eef6f4] font-bold">
                        {pos.currentPrice}
                      </td>
                      <td className="p-3.5 font-mono text-[#ff6470]">
                        {pos.stopLoss}
                      </td>
                      <td className="p-3.5 font-mono text-[#22d3a0]">
                        {pos.takeProfit}
                      </td>
                      <td className="p-3.5 font-mono font-bold">
                        <span
                          className={
                            pos.pnl >= 0 ? "text-[#22d3a0]" : "text-[#ff6470]"
                          }
                        >
                          {pos.pnl >= 0 ? "+" : ""}
                          ${pos.pnl.toFixed(2)} ({pos.pnlPercent >= 0 ? "+" : ""}
                          {pos.pnlPercent.toFixed(1)}%)
                        </span>
                      </td>
                      <td className="p-3.5 pr-5 text-right space-x-2">
                        <button
                          onClick={() => openReasonModal(pos.reasoning)}
                          className="px-2.5 py-1 rounded bg-[#133028] hover:bg-[#1a4438] text-[#22d3a0] font-semibold transition-colors"
                        >
                          [VIEW REASON]
                        </button>
                        <button
                          onClick={() => closePosition(pos.id, "MANUAL_CLOSE")}
                          className="px-2.5 py-1 rounded bg-[#2d1519] hover:bg-[#3d191f] text-[#ff6470] font-semibold transition-colors"
                        >
                          Close
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
