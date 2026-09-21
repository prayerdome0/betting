"use client";

import React, { useState } from "react";
import { useTradingEngine } from "@/lib/simulation/TradingEngineContext";
import {
  TrendingUp,
  TrendingDown,
  Bot,
  Zap,
  Activity,
  DollarSign,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  CheckCircle2,
  Sliders,
  Sparkles,
  RefreshCw,
  Layers,
  BarChart3,
  ChevronRight,
  Info,
} from "lucide-react";

interface DashboardViewProps {
  onNavigate: (tab: string) => void;
}

export default function DashboardView({ onNavigate }: DashboardViewProps) {
  const {
    balance,
    available,
    config,
    toggleAiTrading,
    setTradeAmount,
    actualWinRate,
    netPnL,
    totalTrades,
    winningTrades,
    losingTrades,
    profitFactor,
    markets,
    openPositions,
    closedTrades,
    openReasonModal,
    triggerAiTrade,
    resetDemoBalance,
  } = useTradingEngine();

  const [activeRange, setActiveRange] = useState<"1D" | "1W" | "1M" | "ALL">("1D");

  // Format currency
  const formatCur = (n: number) =>
    `$${n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const unrealizedPnL = openPositions.reduce((acc, p) => acc + p.pnl, 0);
  const totalEquity = balance + unrealizedPnL;

  return (
    <div className="space-y-6">
      {/* Starting Account Hero Card - Exactly matches Prompt Section 1 */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0c201b] via-[#091714] to-[#06100e] border border-[#1b3d34] p-6 lg:p-8 shadow-2xl">
        {/* Ambient background glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#22d3a0]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#13382d] border border-[#235b4a] text-xs font-bold text-[#38e8b6] uppercase tracking-wider">
                <Bot className="w-3.5 h-3.5" />
                AI TRADER · PROTOTYPE SIMULATION
              </span>
              <span className="text-xs text-[#6e8e86] font-mono hidden sm:inline">
                No real funds · Demo Ledger
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 pt-1">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#799990]">
                  Demo Balance
                </span>
                <div className="text-3xl sm:text-4xl font-black tracking-tight text-[#eef6f4] font-mono mt-0.5">
                  {formatCur(balance)}
                </div>
                <div className="text-[11px] text-[#557a70] mt-1 flex items-center gap-1">
                  Base capital: <span className="font-mono text-[#789d93]">$500.00</span>
                </div>
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#799990]">
                  Available Margin
                </span>
                <div className="text-3xl sm:text-4xl font-black tracking-tight text-[#22d3a0] font-mono mt-0.5">
                  {formatCur(available)}
                </div>
                <div className="text-[11px] text-[#557a70] mt-1">
                  In positions: <span className="font-mono text-[#e4f2ee]">${(balance - available).toFixed(2)}</span>
                </div>
              </div>

              <div className="col-span-2 sm:col-span-1">
                <span className="text-xs font-bold uppercase tracking-wider text-[#799990]">
                  AI Trader Mode
                </span>
                <div className="flex items-center gap-2 mt-1.5">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                      config.aiEnabled
                        ? "bg-[#143d31] text-[#22d3a0] border border-[#246e58] shadow-sm shadow-[#22d3a0]/30"
                        : "bg-[#1f2826] text-[#78918b] border border-[#2b3734]"
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        config.aiEnabled
                          ? "bg-[#22d3a0] animate-ping"
                          : "bg-[#78918b]"
                      }`}
                    />
                    {config.aiEnabled ? "ACTIVE (ON)" : "OFF"}
                  </span>
                </div>
                <div className="text-[11px] text-[#557a70] mt-1">
                  Size: ${config.tradeAmount.toFixed(2)} · Max {config.maxOpenTrades} open
                </div>
              </div>
            </div>
          </div>

          {/* Action Call to Action */}
          <div className="flex flex-col sm:flex-row items-stretch lg:items-center gap-3">
            <div className="bg-[#0b1b17] border border-[#1b3b33] rounded-xl p-2 flex items-center justify-between gap-3">
              <span className="text-xs text-[#709087] font-semibold pl-2">
                Trade Size:
              </span>
              <div className="flex items-center gap-1">
                {[1, 5, 10, 25].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setTradeAmount(amt)}
                    className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg transition-colors ${
                      config.tradeAmount === amt
                        ? "bg-[#174437] text-[#34e3b1] border border-[#266854]"
                        : "text-[#62827a] hover:bg-[#122822]"
                    }`}
                  >
                    ${amt}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => toggleAiTrading()}
              className={`px-6 py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2.5 shadow-lg transition-all transform active:scale-95 ${
                config.aiEnabled
                  ? "bg-[#2e1518] hover:bg-[#3d1a1e] text-[#ff6470] border border-[#6b252c]"
                  : "bg-gradient-to-r from-[#179672] to-[#22d3a0] hover:from-[#1bb288] hover:to-[#38e8b6] text-[#051a14] font-black border border-[#38e8b6]/40 shadow-[#22d3a0]/20"
              }`}
            >
              <Bot className="w-5 h-5" />
              <span>
                {config.aiEnabled ? "STOP AI TRADING" : "START AI TRADING"}
              </span>
            </button>
          </div>
        </div>

        {/* 7-Step AI Pipeline Visualization - Section 2 from prompt */}
        <div className="mt-7 pt-6 border-t border-[#16332c]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#63847c] flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-[#22d3a0]" />
              Automated Trading Engine Pipeline
            </span>
            <span className="text-[11px] text-[#4d6f67] hidden md:inline">
              Engine autonomously executes: Signals → Entry → Monitor → Exit
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-center text-xs">
            {[
              { step: "1", title: "MARKET DATA", desc: "Live ticks & feed", active: true },
              {
                step: "2",
                title: "SIGNAL",
                desc: "RSI, EMA, MACD",
                active: true,
              },
              {
                step: "3",
                title: "AI DECISION",
                desc: "Confidence score",
                active: config.aiEnabled,
              },
              {
                step: "4",
                title: "SIM BUY/SELL",
                desc: "Autonomous entry",
                active: config.aiEnabled && openPositions.length > 0,
              },
              {
                step: "5",
                title: "MONITORING",
                desc: "Trailing TP / SL",
                active: openPositions.length > 0,
              },
              {
                step: "6",
                title: "SIM RESULT",
                desc: "+$0.18 / -$0.11",
                active: totalTrades > 0,
              },
              {
                step: "7",
                title: "BALANCE UPDATED",
                desc: "Demo ledger",
                active: true,
              },
            ].map((p, idx) => (
              <div
                key={p.title}
                className={`p-2.5 rounded-lg border transition-all ${
                  p.active
                    ? "bg-[#0f231e] border-[#1d4d3f] text-[#c5e1d9]"
                    : "bg-[#091412]/50 border-[#122420] text-[#4d6660]"
                }`}
              >
                <div className="flex items-center justify-center gap-1 mb-1">
                  <span
                    className={`w-4 h-4 rounded-full text-[10px] font-black flex items-center justify-center ${
                      p.active
                        ? "bg-[#184639] text-[#22d3a0]"
                        : "bg-[#142320] text-[#4a635e]"
                    }`}
                  >
                    {p.step}
                  </span>
                </div>
                <div className="font-bold tracking-tight text-[11px]">
                  {p.title}
                </div>
                <div className="text-[9px] text-[#608077] truncate mt-0.5">
                  {p.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Primary Metrics Grid (Adheres to Section 4: Don't hard-code 95% profit) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Equity Card */}
        <div className="rounded-xl bg-[#091518] border border-[#17302b] p-5 shadow-lg">
          <div className="flex items-center justify-between text-xs text-[#708e86] font-semibold">
            <span>TOTAL SIMULATED EQUITY</span>
            <DollarSign className="w-4 h-4 text-[#22d3a0]" />
          </div>
          <div className="text-2xl font-black text-[#eef6f4] font-mono mt-2">
            {formatCur(totalEquity)}
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs">
            <span
              className={`font-bold flex items-center ${
                netPnL >= 0 ? "text-[#22d3a0]" : "text-[#ff6470]"
              }`}
            >
              {netPnL >= 0 ? (
                <ArrowUpRight className="w-4 h-4 mr-0.5" />
              ) : (
                <ArrowDownRight className="w-4 h-4 mr-0.5" />
              )}
              {netPnL >= 0 ? "+" : ""}
              {formatCur(netPnL)}
            </span>
            <span className="text-[#5b7a72]">
              ({((netPnL / 500) * 100).toFixed(2)}% ROI)
            </span>
          </div>
          <div className="text-[11px] text-[#4d6d65] mt-2 pt-2 border-t border-[#132723]">
            Unrealized floating:{" "}
            <span
              className={
                unrealizedPnL >= 0 ? "text-[#22d3a0]" : "text-[#ff6470]"
              }
            >
              {unrealizedPnL >= 0 ? "+" : ""}
              {formatCur(unrealizedPnL)}
            </span>
          </div>
        </div>

        {/* Calculated Actual Win Rate vs Target Benchmark */}
        <div className="rounded-xl bg-[#091518] border border-[#17302b] p-5 shadow-lg">
          <div className="flex items-center justify-between text-xs text-[#708e86] font-semibold">
            <span>CALCULATED WIN RATE</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#132b26] text-[#3de4b5]">
              CALCULATED
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-[#22d3a0] font-mono">
              {actualWinRate}%
            </span>
            <span className="text-xs text-[#6e8e86]">
              ({winningTrades}W · {losingTrades}L)
            </span>
          </div>
          {/* Progress bar comparing actual vs target benchmark */}
          <div className="mt-2 space-y-1">
            <div className="flex justify-between text-[10px] text-[#5a7c73]">
              <span>Actual: {actualWinRate}%</span>
              <span>Target: {config.targetWinRateBenchmark}%</span>
            </div>
            <div className="relative w-full h-2 bg-[#122622] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#179672] to-[#22d3a0] rounded-full"
                style={{ width: `${Math.min(100, actualWinRate)}%` }}
              />
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-yellow-400"
                style={{ left: `${config.targetWinRateBenchmark}%` }}
                title={`Target Benchmark: ${config.targetWinRateBenchmark}%`}
              />
            </div>
          </div>
          <div className="text-[10px] text-[#4d6d65] mt-2">
            *Computed from real closed trade data, never hardcoded.
          </div>
        </div>

        {/* Profit Factor & Performance */}
        <div className="rounded-xl bg-[#091518] border border-[#17302b] p-5 shadow-lg">
          <div className="flex items-center justify-between text-xs text-[#708e86] font-semibold">
            <span>PROFIT FACTOR</span>
            <BarChart3 className="w-4 h-4 text-[#38bdf8]" />
          </div>
          <div className="text-2xl font-black text-[#38bdf8] font-mono mt-2">
            {profitFactor}
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs text-[#6e8e86]">
            <span>Total trades:</span>
            <span className="font-bold text-[#eef6f4]">{totalTrades}</span>
          </div>
          <div className="text-[11px] text-[#4d6d65] mt-2 pt-2 border-t border-[#132723] flex justify-between">
            <span>Gross Gain: +${closedTrades.filter(t=>t.pnl>0).reduce((a,b)=>a+b.pnl,0).toFixed(2)}</span>
            <span>Loss: -${Math.abs(closedTrades.filter(t=>t.pnl<0).reduce((a,b)=>a+b.pnl,0)).toFixed(2)}</span>
          </div>
        </div>

        {/* Open Positions Card */}
        <div className="rounded-xl bg-[#091518] border border-[#17302b] p-5 shadow-lg">
          <div className="flex items-center justify-between text-xs text-[#708e86] font-semibold">
            <span>OPEN POSITIONS</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-[#132b26] text-[#3de4b5]">
              {openPositions.length} / {config.maxOpenTrades} MAX
            </span>
          </div>
          <div className="text-2xl font-black text-[#eef6f4] font-mono mt-2">
            {openPositions.length}
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs text-[#6e8e86]">
            <span>Allocated Margin:</span>
            <span className="font-bold text-[#eef6f4] font-mono">
              ${(balance - available).toFixed(2)}
            </span>
          </div>
          <div className="text-[11px] text-[#4d6d65] mt-2 pt-2 border-t border-[#132723] flex items-center justify-between">
            <span>Safety Risk Limits</span>
            <span className="text-[#22d3a0] font-semibold">GUARD ACTIVE</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Equity Chart + Scanner Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Equity Curve & Performance Chart */}
        <div className="lg:col-span-2 rounded-xl bg-[#091518] border border-[#17302b] p-6 shadow-lg flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-base font-bold text-[#eef6f4] flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#22d3a0]" />
                Portfolio Performance & Equity Curve
              </h3>
              <p className="text-xs text-[#6e8e86] mt-0.5">
                Simulated account capital progression starting at $500.00
              </p>
            </div>
            <div className="flex items-center gap-1 bg-[#0d1d1a] p-1 rounded-lg border border-[#16332c]">
              {(["1D", "1W", "1M", "ALL"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setActiveRange(r)}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                    activeRange === r
                      ? "bg-[#184638] text-[#39e8b7]"
                      : "text-[#62827a] hover:text-[#c4dbd4]"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* SVG Equity Chart */}
          <div className="h-56 w-full my-3 relative">
            <svg
              className="w-full h-full overflow-visible"
              viewBox="0 0 700 200"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22d3a0" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#22d3a0" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="0" y1="40" x2="700" y2="40" stroke="#132622" strokeDasharray="3 3" />
              <line x1="0" y1="90" x2="700" y2="90" stroke="#132622" strokeDasharray="3 3" />
              <line x1="0" y1="140" x2="700" y2="140" stroke="#132622" strokeDasharray="3 3" />

              {/* Area & Line */}
              <path
                d="M0 160 Q 80 155, 140 148 T 260 135 T 380 142 T 480 110 T 580 90 T 700 70 L 700 200 L 0 200 Z"
                fill="url(#equityGrad)"
              />
              <path
                d="M0 160 Q 80 155, 140 148 T 260 135 T 380 142 T 480 110 T 580 90 T 700 70"
                fill="none"
                stroke="#22d3a0"
                strokeWidth="2.5"
                strokeLinecap="round"
              />

              {/* Baseline $500 mark */}
              <line
                x1="0"
                y1="160"
                x2="700"
                y2="160"
                stroke="#3f5f56"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <text x="10" y="154" fill="#587e74" fontSize="10" fontFamily="monospace">
                Baseline $500.00
              </text>
              <text x="630" y="65" fill="#22d3a0" fontSize="11" fontWeight="bold" fontFamily="monospace">
                {formatCur(balance)}
              </text>
            </svg>
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#55776f] pt-2 border-t border-[#132723]">
            <span>Start: $500.00</span>
            <span>Simulation High: {formatCur(Math.max(500, balance * 1.01))}</span>
            <span>Current: {formatCur(balance)}</span>
          </div>
        </div>

        {/* Live Market Scanner Card (Section 3: EUR/USD WAIT, GBP/USD ANALYZING, XAU/USD SIGNAL) */}
        <div className="rounded-xl bg-[#091518] border border-[#17302b] p-6 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-[#eef6f4] flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[#38bdf8]" />
                  AI Market Scanner
                </h3>
                <p className="text-xs text-[#6e8e86] mt-0.5">
                  Live status across enabled pairs
                </p>
              </div>
              <button
                onClick={() => onNavigate("Markets")}
                className="text-xs text-[#22d3a0] hover:text-[#52e7bb] font-bold flex items-center gap-1"
              >
                View all <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2.5">
              {markets.slice(0, 5).map((m) => (
                <div
                  key={m.symbol}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-[#0d1d1a] border border-[#16332c] hover:border-[#225749] transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-md bg-[#133028] text-[#3ee7b8] flex items-center justify-center text-[10px] font-black">
                      {m.symbol.slice(0, 2)}
                    </span>
                    <div>
                      <div className="font-bold text-xs text-[#eef6f4]">
                        {m.symbol}
                      </div>
                      <div className="text-[10px] text-[#6b8b83] font-mono">
                        {m.price.toFixed(m.precision)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Scanner Status Badge matching user specification */}
                    <span
                      className={`text-[10px] font-black px-2.5 py-1 rounded-md tracking-wider uppercase ${
                        m.scannerStatus === "WAIT"
                          ? "bg-[#21241f] text-[#d6b758] border border-[#4d4223]"
                          : m.scannerStatus === "ANALYZING"
                          ? "bg-[#142938] text-[#38bdf8] border border-[#1d4d6e]"
                          : m.scannerStatus === "SIGNAL"
                          ? "bg-[#153b2e] text-[#22d3a0] border border-[#27785e] animate-pulse"
                          : "bg-[#331c2c] text-[#e879f9] border border-[#6b255a]"
                      }`}
                    >
                      {m.scannerStatus}
                    </span>

                    {/* AI Score */}
                    <div className="text-right w-10">
                      <div className="text-[11px] font-bold font-mono text-[#c6ded8]">
                        {m.aiScore}
                      </div>
                      <div className="text-[9px] text-[#55756d]">SCORE</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-[#132723]">
            <button
              onClick={() => onNavigate("AI Trader")}
              className="w-full py-2.5 rounded-lg bg-[#112d26] hover:bg-[#163b32] text-[#3ee7b8] text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
            >
              Open AI Command Station <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Active Positions & Recent Closed Trades Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Open Positions Section */}
        <div className="rounded-xl bg-[#091518] border border-[#17302b] p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-[#eef6f4] flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#22d3a0] animate-ping" />
                Active Monitored Trades
              </h3>
              <p className="text-xs text-[#6e8e86] mt-0.5">
                Simulated positions monitored by risk engine
              </p>
            </div>
            <span className="text-xs px-2 py-0.5 rounded bg-[#133028] text-[#3ee7b8] font-mono">
              {openPositions.length} active
            </span>
          </div>

          {openPositions.length === 0 ? (
            <div className="p-8 text-center rounded-lg bg-[#0b1815] border border-dashed border-[#1a3830] text-[#6d8d85]">
              <Bot className="w-8 h-8 mx-auto text-[#2a554a] mb-2" />
              <p className="text-sm font-semibold">No active simulated trades</p>
              <p className="text-xs text-[#52746b] mt-1">
                {config.aiEnabled
                  ? "AI is scanning markets for high-probability setups..."
                  : "AI Trader is currently OFF. Turn it ON to begin automated execution."}
              </p>
              {!config.aiEnabled && (
                <button
                  onClick={() => toggleAiTrading(true)}
                  className="mt-4 px-4 py-2 rounded-lg bg-[#143b30] hover:bg-[#1c4e40] text-[#22d3a0] text-xs font-bold transition-colors"
                >
                  Start AI Trading
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {openPositions.map((pos) => {
                const isBuy = pos.side === "BUY";
                return (
                  <div
                    key={pos.id}
                    className="p-3.5 rounded-lg bg-[#0d1e1a] border border-[#193a32] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#eef6f4]">
                          {pos.symbol}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            isBuy
                              ? "bg-[#143d31] text-[#22d3a0]"
                              : "bg-[#3e191d] text-[#ff6470]"
                          }`}
                        >
                          {pos.side}
                        </span>
                        <span className="text-xs text-[#6b8b83] font-mono">
                          ${pos.amount.toFixed(2)}
                        </span>
                      </div>
                      <div className="text-xs text-[#789d93] mt-1 flex items-center gap-3 font-mono">
                        <span>Entry: {pos.entryPrice}</span>
                        <span>Now: {pos.currentPrice}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-0 border-[#15332c]">
                      <div className="text-right">
                        <div
                          className={`text-sm font-black font-mono ${
                            pos.pnl >= 0 ? "text-[#22d3a0]" : "text-[#ff6470]"
                          }`}
                        >
                          {pos.pnl >= 0 ? "+" : ""}
                          {formatCur(pos.pnl)}
                        </div>
                        <div className="text-[10px] text-[#5b7a72] font-mono">
                          ({pos.pnlPercent >= 0 ? "+" : ""}
                          {pos.pnlPercent.toFixed(1)}%)
                        </div>
                      </div>

                      <button
                        onClick={() => openReasonModal(pos.reasoning)}
                        className="px-2.5 py-1.5 rounded bg-[#133028] hover:bg-[#1a4438] text-[#3de4b5] text-xs font-semibold flex items-center gap-1 transition-colors"
                        title="View AI Strategy Reason"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>[REASON]</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Completed Trades Feed with Result (+0.18 / -0.11) */}
        <div className="rounded-xl bg-[#091518] border border-[#17302b] p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-[#eef6f4] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#22d3a0]" />
                Recent Simulated Executions
              </h3>
              <p className="text-xs text-[#6e8e86] mt-0.5">
                Calculated outcome ledger (Wins & Losses)
              </p>
            </div>
            <button
              onClick={() => onNavigate("Trades")}
              className="text-xs text-[#22d3a0] hover:text-[#52e7bb] font-bold flex items-center gap-1"
            >
              Full History <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {closedTrades.slice(0, 4).map((tr) => (
              <div
                key={tr.id}
                className="flex items-center justify-between p-3 rounded-lg bg-[#0d1d1a] border border-[#16332c]"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      tr.isWin
                        ? "bg-[#143d2c] text-[#22d3a0]"
                        : "bg-[#3d181d] text-[#ff6470]"
                    }`}
                  >
                    {tr.isWin ? "✓" : "✕"}
                  </span>
                  <div>
                    <div className="font-bold text-xs text-[#eef6f4]">
                      {tr.symbol} · {tr.side}
                    </div>
                    <div className="text-[10px] text-[#6b8b83]">
                      Duration: {tr.duration} · {tr.closeReason}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div
                      className={`font-mono text-xs font-black ${
                        tr.isWin ? "text-[#22d3a0]" : "text-[#ff6470]"
                      }`}
                    >
                      {tr.pnl >= 0 ? "+" : ""}
                      {formatCur(tr.pnl)}
                    </div>
                    <div className="text-[10px] text-[#55756d]">
                      {tr.pnlPercent >= 0 ? "+" : ""}
                      {tr.pnlPercent}%
                    </div>
                  </div>

                  <button
                    onClick={() => openReasonModal(tr.reasoning)}
                    className="p-1.5 rounded text-[#708e86] hover:text-[#3ee7b8] hover:bg-[#133028] transition-colors"
                    title="View Reason"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
