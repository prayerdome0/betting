"use client";

import React, { useState } from "react";
import { useTradingEngine } from "@/lib/simulation/TradingEngineContext";
import {
  ShieldAlert,
  Terminal,
  Activity,
  Bot,
  RefreshCw,
  Sparkles,
  RotateCcw,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Database,
  Cpu,
  Server,
  Zap,
} from "lucide-react";

export default function AdminView() {
  const {
    balance,
    available,
    openPositions,
    closedTrades,
    withdrawalRequests,
    config,
    systemLogs,
    fastForwardTrades,
    triggerAiTrade,
    resetDemoBalance,
    closePosition,
    addSystemLog,
  } = useTradingEngine();

  const [filterModule, setFilterModule] = useState<string>("ALL");
  const [activeAdminTab, setActiveAdminTab] = useState<"LOGS" | "ARCHITECTURE" | "CONTROLS">("LOGS");

  const filteredLogs = systemLogs.filter((l) => {
    if (filterModule === "ALL") return true;
    return l.module === filterModule;
  });

  const handleForceCloseAll = () => {
    openPositions.forEach((pos) => {
      closePosition(pos.id, "MANUAL_CLOSE");
    });
    addSystemLog(
      "WARNING",
      "RISK_ENGINE",
      `Emergency Action: Force liquidated ${openPositions.length} open positions.`
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl bg-[#091518] border border-[#17302b] p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold tracking-wider text-[#7ea399] uppercase">
                SYSTEM CONTROL & DIAGNOSTICS
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#16362e] text-[#4ee4b8] font-mono">
                ADMIN CONSOLE
              </span>
            </div>
            <h2 className="text-xl font-bold text-[#eef6f4] mt-1">
              Engine Health & Execution Architecture
            </h2>
            <p className="text-xs text-[#6e8e86] mt-0.5">
              Monitor quantitative subsystems, audit risk checks, and inspect system telemetry
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0e241e] border border-[#1a4b3d] text-xs font-mono text-[#22d3a0]">
              <span className="w-2 h-2 rounded-full bg-[#22d3a0] animate-ping" />
              SYSTEM 100% OPERATIONAL
            </span>
          </div>
        </div>
      </div>

      {/* Admin Nav Tabs */}
      <div className="flex items-center gap-2 border-b border-[#142d27] pb-2">
        {[
          { id: "LOGS", label: "Real-Time Subsystem Logs", icon: Terminal },
          { id: "ARCHITECTURE", label: "Backend Architecture & Live Broker Bridge", icon: Server },
          { id: "CONTROLS", label: "Simulation Diagnostics & Fast-Forward", icon: Sliders },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeAdminTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveAdminTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                isActive
                  ? "bg-[#184638] text-[#3ee7b8] border border-[#276a56]"
                  : "text-[#6e8e86] hover:bg-[#0c1815] hover:text-[#c6ded8]"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Subsystem Terminal Logs */}
      {activeAdminTab === "LOGS" && (
        <div className="rounded-xl bg-[#06100e] border border-[#17302b] shadow-2xl overflow-hidden font-mono text-xs">
          <div className="p-4 bg-[#0a1815] border-b border-[#142d27] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[#7ea198]">
              <Terminal className="w-4 h-4 text-[#22d3a0]" />
              <span className="font-bold">SYSTEM TELEMETRY CONSOLE</span>
              <span className="text-[10px] text-[#4d6d65]">
                ({filteredLogs.length} events recorded)
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-[#55756d]">MODULE:</span>
              {["ALL", "SIMULATOR", "AI_DECISION", "RISK_ENGINE", "TRADE_ENGINE"].map(
                (mod) => (
                  <button
                    key={mod}
                    onClick={() => setFilterModule(mod)}
                    className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                      filterModule === mod
                        ? "bg-[#184638] text-[#3ee7b8]"
                        : "text-[#62827a] hover:bg-[#122420]"
                    }`}
                  >
                    {mod}
                  </button>
                )
              )}
            </div>
          </div>

          <div className="p-4 max-h-[460px] overflow-y-auto space-y-2 text-[#c6ded8]">
            {filteredLogs.map((log) => {
              const isInfo = log.level === "INFO";
              const isSuccess = log.level === "SUCCESS";
              const isWarning = log.level === "WARNING";
              const isDanger = log.level === "DANGER";
              const isAi = log.level === "AI";

              return (
                <div
                  key={log.id}
                  className="p-2 rounded bg-[#091513] border border-[#122822] flex items-start gap-3 hover:bg-[#0c1a17] transition-colors"
                >
                  <span className="text-[#55756d] shrink-0 text-[10px]">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>

                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-bold shrink-0 ${
                      isInfo
                        ? "bg-[#122838] text-[#38bdf8]"
                        : isSuccess
                        ? "bg-[#143b2b] text-[#22d3a0]"
                        : isWarning
                        ? "bg-[#2d2514] text-[#fbbf24]"
                        : isDanger
                        ? "bg-[#361519] text-[#ff6470]"
                        : "bg-[#271536] text-[#c084fc]"
                    }`}
                  >
                    [{log.module}]
                  </span>

                  <span className="flex-1 break-words">{log.message}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Backend Architecture & Live Broker Bridge (Sections 6 & 7) */}
      {activeAdminTab === "ARCHITECTURE" && (
        <div className="space-y-6">
          {/* Section 6 Diagram Card */}
          <div className="rounded-xl bg-[#091518] border border-[#17302b] p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-[#eef6f4] flex items-center gap-2">
              <Database className="w-5 h-5 text-[#22d3a0]" />
              Section 6: Working Quantitative Backend Architecture
            </h3>
            <p className="text-xs text-[#7ea198] leading-relaxed">
              Nexus AI Trader is designed as a genuinely functional event-driven architecture rather than a static front-end mockup:
            </p>

            <div className="p-4 rounded-lg bg-[#06100e] border border-[#142d27] font-mono text-xs text-[#3ee7b8] overflow-x-auto leading-relaxed">
              <pre>{`APP (Next.js 16 + React 19 Client Dashboard)
      │
      ▼
  BACKEND API (/api/simulation/state, /api/simulation/trade, /api/markets)
      │
┌─────┼─────────────────────────┐
▼     ▼                         ▼
MARKET DATA (Brownian)    AI / STRATEGY ENGINE      SIMULATOR (Demo Ledger)
│     │                         │
└─────┼─────────────────────────┘
      ▼
 RISK ENGINE (Bracket Validation, Max Drawdown, Slippage Tolerance)
      │
      ▼
 TRADE ENGINE (Autonomous Execution & Position Trailing)
      │
      ▼
 DATABASE & STATE STORE (Balance $500, Positions, History, Withdrawals)`}</pre>
            </div>
          </div>

          {/* Section 7 Diagram Card: SIMULATION vs LIVE BROKER */}
          <div className="rounded-xl bg-[#091518] border border-[#17302b] p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-[#eef6f4] flex items-center gap-2">
              <Server className="w-5 h-5 text-[#38bdf8]" />
              Section 7: Future Live Broker Execution Separation
            </h3>
            <p className="text-xs text-[#7ea198] leading-relaxed">
              Clean architectural boundary preventing simulated test trades from accidentally executing against real capital:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-[#0a1b16] border border-[#1b4438] space-y-2">
                <span className="text-xs font-bold font-mono text-[#22d3a0] uppercase block">
                  LAYER A: SIMULATION ENVIRONMENT (ACTIVE)
                </span>
                <div className="font-mono text-xs text-[#a2c8be] space-y-1">
                  <div>• Real & Synthetic Market Data Feeds</div>
                  <div>• Multi-Timeframe Strategy Matrix</div>
                  <div>• AI Neural Scoring & Reasoning Engine</div>
                  <div>• Virtual Execution Engine (Demo Balance $500.00)</div>
                  <div>• Simulated Outcomes (+18% / -11%)</div>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-[#141d24] border border-[#213b4c] space-y-2">
                <span className="text-xs font-bold font-mono text-[#38bdf8] uppercase block">
                  LAYER B: LIVE BROKER API (PLANNED)
                </span>
                <div className="font-mono text-xs text-[#a2c3db] space-y-1">
                  <div>• Authenticated Broker API (FIX Protocol / CCXT)</div>
                  <div>• Multi-Sig Key Vault with Cold Storage</div>
                  <div>• Strict Hardware Risk Circuit Breaker</div>
                  <div>• Real Capital Execution with Slippage Caps</div>
                  <div>• Direct Post-Trade Settlement</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Simulation Diagnostics & Fast Forward */}
      {activeAdminTab === "CONTROLS" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="rounded-xl bg-[#091518] border border-[#17302b] p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-[#eef6f4] flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#22d3a0]" />
              Fast-Forward Simulation Data
            </h3>
            <p className="text-xs text-[#6e8e86]">
              Instantly generate batches of realistic trades to demonstrate calculated win rates, profit factor, and equity curve behavior.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={() => fastForwardTrades(5)}
                className="px-4 py-2.5 rounded-lg bg-[#143d31] hover:bg-[#1c4e40] text-[#22d3a0] text-xs font-bold transition-all"
              >
                +5 Simulated Trades
              </button>
              <button
                onClick={() => fastForwardTrades(15)}
                className="px-4 py-2.5 rounded-lg bg-[#184638] hover:bg-[#205747] text-[#34e3b1] text-xs font-bold transition-all"
              >
                +15 Simulated Trades
              </button>
              <button
                onClick={() => triggerAiTrade()}
                className="px-4 py-2.5 rounded-lg bg-[#142b3b] hover:bg-[#1a384d] text-[#38bdf8] text-xs font-bold transition-all"
              >
                Force AI Trade Entry
              </button>
            </div>
          </div>

          <div className="rounded-xl bg-[#091518] border border-[#3e191d] p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-[#ff6470] flex items-center gap-2">
              <ShieldAlert className="w-5 h-5" />
              Emergency Reset & Liquidation
            </h3>
            <p className="text-xs text-[#6e8e86]">
              Clear running positions or reset demo ledger back to the original $500.00 baseline.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={handleForceCloseAll}
                disabled={openPositions.length === 0}
                className="px-4 py-2.5 rounded-lg bg-[#2e1518] hover:bg-[#3d1a1e] text-[#ff6470] text-xs font-bold transition-all disabled:opacity-40"
              >
                Liquidate All Open ({openPositions.length})
              </button>
              <button
                onClick={resetDemoBalance}
                className="px-4 py-2.5 rounded-lg bg-[#251b14] hover:bg-[#35251a] text-[#fbbf24] text-xs font-bold transition-all"
              >
                Reset Demo to $500.00
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
