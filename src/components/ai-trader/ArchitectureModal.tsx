"use client";

import React from "react";
import {
  X,
  Database,
  Cpu,
  Server,
  ShieldCheck,
  Activity,
  Layers,
  ArrowRight,
  Lock,
  GitBranch,
} from "lucide-react";

interface ArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ArchitectureModal({
  isOpen,
  onClose,
}: ArchitectureModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div
        className="relative w-full max-w-3xl bg-[#091518] border border-[#1b3530] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#17302b] bg-[#0d1d1a]/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#14382f] border border-[#225749] flex items-center justify-center text-[#22d3a0]">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-mono font-bold tracking-wider text-[#7ea399] uppercase">
                SYSTEM ARCHITECTURE & ROADMAP
              </div>
              <h2 className="text-lg font-bold text-[#eef6f4]">
                Sections 6 & 7: Engine Architecture & Live Broker Bridge
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-[#708e86] hover:text-white rounded-lg hover:bg-[#122823] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-[#c8ded8]">
          {/* Section 6 Explanation */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-[#22d3a0] uppercase tracking-wider flex items-center gap-2">
              <Cpu className="w-4 h-4" />
              6. The Working Quantitative Backend Pipeline
            </h3>
            <p className="text-xs text-[#9ebcb2] leading-relaxed">
              This application is built with real functional components rather than a static presentation front end. Every market tick traverses the full 7-step pipeline:
            </p>

            <div className="p-4 rounded-xl bg-[#06100e] border border-[#142d27] font-mono text-xs text-[#3ee7b8] overflow-x-auto leading-relaxed">
              <pre>{`APP (Dashboard / AI Command / Terminal)
                     │
                     ▼
                 BACKEND API
                     │
       ┌─────────────┼─────────────┐
       ▼             ▼             ▼
  MARKET DATA    AI/STRATEGY    SIMULATOR
       │             │             │
       └─────────────┼─────────────┘
                     ▼
                RISK ENGINE
                     │
                     ▼
               TRADE ENGINE
                     │
                     ▼
                  DATABASE / STATE STORE`}</pre>
            </div>

            <div className="p-4 rounded-lg bg-[#0c1815] border border-[#17302a] text-xs space-y-1.5 text-[#a4c7be]">
              <div className="font-bold text-[#eef6f4] mb-1">
                State Maintained by the Simulator:
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
                <div>• balance ($500 start)</div>
                <div>• open positions</div>
                <div>• entry prices</div>
                <div>• exit prices</div>
                <div>• profit/loss ($ & %)</div>
                <div>• trade history</div>
                <div>• AI scanner state</div>
                <div>• timestamps & latency</div>
              </div>
            </div>
          </div>

          {/* Section 7 Explanation */}
          <div className="space-y-3 pt-4 border-t border-[#152e28]">
            <h3 className="text-sm font-bold text-[#38bdf8] uppercase tracking-wider flex items-center gap-2">
              <GitBranch className="w-4 h-4" />
              7. Separation of Simulation vs. Live Broker Execution
            </h3>
            <p className="text-xs text-[#9ebcb2] leading-relaxed">
              To ensure safety and prevent simulated testing from accidentally issuing orders to real brokerage accounts, the architecture strictly segregates the execution layers:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-[#0a1b16] border border-[#1c4438] space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[#22d3a0] font-mono uppercase">
                  <ShieldCheck className="w-4 h-4" />
                  <span>SIMULATION LAYER (CURRENT)</span>
                </div>
                <p className="text-xs text-[#8ab2a6] leading-relaxed">
                  Real market data feeds strategy analysis and AI decisioning. Orders route into the local virtual ledger. Completely zero risk to personal capital.
                </p>
                <div className="text-[11px] font-mono text-[#528275] pt-1">
                  Status: ACTIVE · $500 DEMO BALANCE
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#121b22] border border-[#1f3d52] space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[#38bdf8] font-mono uppercase">
                  <Lock className="w-4 h-4" />
                  <span>LIVE BROKER LAYER (FUTURE)</span>
                </div>
                <p className="text-xs text-[#88acc4] leading-relaxed">
                  Direct connection via encrypted API credentials to authorized brokers (MetaTrader Bridge, FIX protocol, CCXT, Alpaca, Interactive Brokers). Hardware circuit-breaker limits.
                </p>
                <div className="text-[11px] font-mono text-[#4e7894] pt-1">
                  Status: LOCKED · SANDBOX PROTOTYPE
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-[#17302b] bg-[#0a1714]">
          <span className="text-[11px] text-[#55736c] font-mono">
            Nexus AI Trader · Quantitative Engine v2.8
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#153a31] hover:bg-[#1a473c] text-[#4de1b2] font-semibold text-xs transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
