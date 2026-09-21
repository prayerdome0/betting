"use client";

import React from "react";
import { AIReasoning } from "@/types/trading";
import {
  X,
  Brain,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Activity,
  Layers,
  Clock,
  Zap,
  Target,
  AlertTriangle,
  Cpu,
} from "lucide-react";

interface ReasoningModalProps {
  reason: AIReasoning | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ReasoningModal({
  reason,
  isOpen,
  onClose,
}: ReasoningModalProps) {
  if (!isOpen || !reason) return null;

  const isBuy = reason.side === "BUY";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        className="relative w-full max-w-2xl bg-[#091518] border border-[#1b3530] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#17302b] bg-[#0d1d1a]/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#14382f] border border-[#225749] flex items-center justify-center text-[#22d3a0]">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold tracking-wider text-[#7ea399] uppercase">
                  AI DECISION & REASONING LOG
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#16362e] text-[#4ee4b8] font-mono">
                  {reason.tradeId}
                </span>
              </div>
              <h2 className="text-lg font-bold text-[#eef6f4] flex items-center gap-2">
                <span>{reason.symbol}</span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                    isBuy
                      ? "bg-[#143b2f] text-[#22d3a0] border border-[#236b56]"
                      : "bg-[#3d191d] text-[#ff6470] border border-[#6b252c]"
                  }`}
                >
                  {isBuy ? (
                    <TrendingUp className="w-3 h-3 mr-1" />
                  ) : (
                    <TrendingDown className="w-3 h-3 mr-1" />
                  )}
                  {reason.side}
                </span>
                <span className="text-xs text-[#708e86] font-normal">
                  ({reason.strategyModel} · {reason.strategyVersion})
                </span>
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-[#708e86] hover:text-white rounded-lg hover:bg-[#122823] transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm text-[#c8ded8]">
          {/* Executive Confidence Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-lg bg-[#0c1916] border border-[#17302a]">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-[#78968f] mb-1">
                <Zap className="w-3.5 h-3.5 text-[#22d3a0]" />
                <span>AI Confidence Score</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-[#22d3a0]">
                  {reason.confidence}%
                </span>
                <span className="text-[10px] text-[#5b7a72]">High Conviction</span>
              </div>
              <div className="w-full h-1.5 bg-[#172b27] rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#179672] to-[#22d3a0] rounded-full"
                  style={{ width: `${reason.confidence}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-xs text-[#78968f] mb-1">
                <Target className="w-3.5 h-3.5 text-[#38bdf8]" />
                <span>Risk / Reward Ratio</span>
              </div>
              <div className="text-2xl font-black text-[#38bdf8]">
                {reason.riskRewardRatio}
              </div>
              <p className="text-[10px] text-[#5b7a72] mt-1">
                Positive asymmetric expectation
              </p>
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-xs text-[#78968f] mb-1">
                <Clock className="w-3.5 h-3.5 text-[#fbbf24]" />
                <span>Execution Latency</span>
              </div>
              <div className="text-2xl font-black text-[#fbbf24]">
                {reason.latencyMs} ms
              </div>
              <p className="text-[10px] text-[#5b7a72] mt-1">
                Simulated institutional route
              </p>
            </div>
          </div>

          {/* AI Narrative Rationale */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-[#698a82] uppercase">
              <Cpu className="w-4 h-4 text-[#22d3a0]" />
              <span>Algorithmic Rationale</span>
            </div>
            <div className="p-4 rounded-lg bg-[#0e1c19] border border-[#1b3b33] text-sm leading-relaxed text-[#d6eae4]">
              {reason.rationale}
            </div>
          </div>

          {/* Bracket Specification: Stop & Target */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-[#698a82] uppercase">
              <ShieldCheck className="w-4 h-4 text-[#38bdf8]" />
              <span>Execution Bracket & Risk Boundary</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-[#142320] border border-[#1f3e37]">
                <div className="text-[11px] text-[#71928a] mb-0.5">Take Profit Target</div>
                <div className="text-base font-bold font-mono text-[#22d3a0]">
                  {reason.takeProfitPrice}
                </div>
                <div className="text-[10px] text-[#4d756b] mt-1">
                  Targeted structural exit
                </div>
              </div>
              <div className="p-3 rounded-lg bg-[#211517] border border-[#3e1f24]">
                <div className="text-[11px] text-[#a07478] mb-0.5">Stop Loss Protection</div>
                <div className="text-base font-bold font-mono text-[#ff6470]">
                  {reason.stopLossPrice}
                </div>
                <div className="text-[10px] text-[#7d4e53] mt-1">
                  Hard risk stop beyond swing
                </div>
              </div>
            </div>
            <p className="text-[11px] text-[#6b8b83] px-1">
              {reason.stopTargetRationale}
            </p>
          </div>

          {/* Technical Indicators Breakdown Matrix */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-[#698a82] uppercase">
              <Activity className="w-4 h-4 text-[#fbbf24]" />
              <span>Multi-Timeframe Indicator Signals</span>
            </div>

            <div className="divide-y divide-[#172c27] rounded-lg border border-[#17302a] bg-[#0c1815] overflow-hidden text-xs">
              <div className="grid grid-cols-3 p-2.5">
                <span className="text-[#6d8a83] font-medium">RSI (14 Period)</span>
                <span className="col-span-2 font-mono text-[#e4f1ed]">
                  {reason.indicators.rsi}{" "}
                  <span className="text-[#72928a] text-[11px]">
                    ({reason.indicators.rsi < 45 ? "Oversold bounce" : reason.indicators.rsi > 65 ? "Overbought pull" : "Momentum expansion"})
                  </span>
                </span>
              </div>
              <div className="grid grid-cols-3 p-2.5">
                <span className="text-[#6d8a83] font-medium">EMA Structural Trend</span>
                <span className="col-span-2 text-[#c6ded8]">
                  {reason.indicators.emaTrend}
                </span>
              </div>
              <div className="grid grid-cols-3 p-2.5">
                <span className="text-[#6d8a83] font-medium">MACD Divergence</span>
                <span className="col-span-2 text-[#c6ded8]">
                  {reason.indicators.macdStatus}
                </span>
              </div>
              <div className="grid grid-cols-3 p-2.5">
                <span className="text-[#6d8a83] font-medium">Liquidity Structure</span>
                <span className="col-span-2 text-[#c6ded8]">
                  {reason.indicators.supportResistance}
                </span>
              </div>
              <div className="grid grid-cols-3 p-2.5">
                <span className="text-[#6d8a83] font-medium">Order Book Profile</span>
                <span className="col-span-2 text-[#c6ded8]">
                  {reason.indicators.orderFlow}
                </span>
              </div>
              <div className="grid grid-cols-3 p-2.5">
                <span className="text-[#6d8a83] font-medium">Volatility & Spread</span>
                <span className="col-span-2 font-mono text-[#a5c2bc]">
                  {reason.indicators.volatilityAtr}
                </span>
              </div>
            </div>
          </div>

          {/* Institutional Compliance Seal */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-[#091f1a]/60 border border-[#1a4438] text-[11px] text-[#7aa59b]">
            <ShieldCheck className="w-5 h-5 text-[#22d3a0] shrink-0" />
            <div>
              <strong className="text-[#22d3a0] font-semibold">
                Risk Engine Validated:
              </strong>{" "}
              Order passed all simulated slippage tolerances, margin requirements, and maximum open trade limits.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-[#17302b] bg-[#0a1714]">
          <span className="text-[11px] text-[#55736c] font-mono">
            Recorded: {new Date(reason.timestamp).toLocaleTimeString()} · Simulation Engine
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#153a31] hover:bg-[#1a473c] text-[#4de1b2] font-semibold text-xs transition-colors"
          >
            Close Reason
          </button>
        </div>
      </div>
    </div>
  );
}
