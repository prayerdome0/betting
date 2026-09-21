"use client";

import React from "react";
import { AITradeEvent } from "@/types/trading";
import { useTradingEngine } from "@/lib/simulation/TradingEngineContext";
import {
  TrendingUp,
  TrendingDown,
  X,
  Eye,
  Bot,
  CheckCircle2,
  XCircle,
  Activity,
} from "lucide-react";

interface LiveEventBannerProps {
  event: AITradeEvent | null;
}

export default function LiveEventBanner({ event }: LiveEventBannerProps) {
  const { openReasonModal, dismissLastEvent } = useTradingEngine();

  if (!event) return null;

  const isOpen = event.type === "AI_TRADE_OPENED";
  const isWin = event.type === "TRADE_CLOSED_WIN";
  const isLoss = event.type === "TRADE_CLOSED_LOSS";
  const isBuy = event.action === "BUY";

  return (
    <div className="fixed bottom-6 right-6 z-40 max-w-sm w-full animate-slide-up shadow-2xl">
      <div
        className={`relative overflow-hidden rounded-xl border p-4.5 backdrop-blur-xl ${
          isOpen
            ? "bg-[#0b1c18]/95 border-[#1e4d3f] shadow-[#00e599]/10"
            : isWin
            ? "bg-[#0a201a]/95 border-[#22c55e]/50 shadow-[#22c55e]/15"
            : "bg-[#220f12]/95 border-[#ef4444]/50 shadow-[#ef4444]/15"
        }`}
      >
        {/* Top Accent bar */}
        <div
          className={`absolute top-0 left-0 right-0 h-1 ${
            isOpen
              ? "bg-gradient-to-r from-[#22d3a0] to-[#38bdf8]"
              : isWin
              ? "bg-gradient-to-r from-[#22c55e] to-[#4ade80]"
              : "bg-gradient-to-r from-[#ef4444] to-[#f87171]"
          }`}
        />

        {/* Dismiss button */}
        <button
          onClick={dismissLastEvent}
          className="absolute top-2.5 right-2.5 p-1 text-[#6b8b83] hover:text-white rounded transition-colors"
          title="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Event Header */}
        <div className="flex items-center gap-2.5 mb-2.5">
          {isOpen && (
            <div className="flex items-center gap-2 text-sm font-black tracking-wider text-[#22d3a0]">
              <span className="text-lg">🤖</span>
              <span>AI TRADE</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#12362b] text-[#55e2b7] font-semibold border border-[#1f5747]">
                LIVE EXECUTION
              </span>
            </div>
          )}

          {isWin && (
            <div className="flex items-center gap-2 text-sm font-black tracking-wider text-[#22c55e]">
              <span className="text-lg">✅</span>
              <span>TRADE CLOSED</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#123b28] text-[#4ade80] font-semibold">
                PROFIT
              </span>
            </div>
          )}

          {isLoss && (
            <div className="flex items-center gap-2 text-sm font-black tracking-wider text-[#ef4444]">
              <span className="text-lg">❌</span>
              <span>TRADE CLOSED</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#3d161a] text-[#f87171] font-semibold">
                STOP TRIGGERED
              </span>
            </div>
          )}
        </div>

        {/* Event Body details matching user prompt */}
        {isOpen ? (
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-center text-[#9dbcb3]">
              <span>Asset:</span>
              <span className="font-bold text-[#eef6f4] font-mono">
                {event.asset}
              </span>
            </div>

            <div className="flex justify-between items-center text-[#9dbcb3]">
              <span>Action:</span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                  isBuy
                    ? "bg-[#143d31] text-[#22d3a0]"
                    : "bg-[#3e191d] text-[#ff6470]"
                }`}
              >
                {isBuy ? (
                  <TrendingUp className="w-3 h-3 mr-1" />
                ) : (
                  <TrendingDown className="w-3 h-3 mr-1" />
                )}
                {event.action}
              </span>
            </div>

            <div className="flex justify-between items-center text-[#9dbcb3]">
              <span>Amount:</span>
              <span className="font-bold text-[#eef6f4] font-mono">
                ${event.amount.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between items-center text-[#9dbcb3]">
              <span>Entry:</span>
              <span className="font-bold text-[#eef6f4] font-mono">
                {event.entry}
              </span>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-[#17382e] mt-2">
              <span className="text-[11px] text-[#22d3a0] flex items-center gap-1.5 animate-pulse font-medium">
                <Activity className="w-3.5 h-3.5" />
                AI is monitoring...
              </span>

              {event.reasoning && (
                <button
                  onClick={() => openReasonModal(event.reasoning!)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#38bdf8] hover:text-[#7dd3fc] underline underline-offset-2"
                >
                  <Eye className="w-3 h-3" />
                  [VIEW REASON]
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-center text-[#9dbcb3]">
              <span>Asset & Action:</span>
              <span className="font-bold text-[#eef6f4] font-mono">
                {event.asset} ({event.action})
              </span>
            </div>

            <div className="flex justify-between items-center text-[#9dbcb3]">
              <span>Result:</span>
              <span
                className={`font-black font-mono text-sm ${
                  (event.result ?? 0) >= 0 ? "text-[#22c55e]" : "text-[#ef4444]"
                }`}
              >
                {(event.result ?? 0) >= 0 ? "+" : ""}
                ${(event.result ?? 0).toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between items-center text-[#9dbcb3]">
              <span>Demo Balance:</span>
              <span className="font-black text-[#eef6f4] font-mono text-sm">
                ${event.demoBalance.toFixed(2)}
              </span>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-[#20362f] mt-2">
              <span className="text-[10px] text-[#6b8b83]">
                Simulated execution ledger updated
              </span>

              {event.reasoning && (
                <button
                  onClick={() => openReasonModal(event.reasoning!)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-[#38bdf8] hover:text-[#7dd3fc] underline underline-offset-2"
                >
                  <Eye className="w-3 h-3" />
                  [VIEW REASON]
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
