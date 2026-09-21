"use client";

import React, { useState } from "react";
import {
  TradingEngineProvider,
  useTradingEngine,
} from "@/lib/simulation/TradingEngineContext";
import DashboardView from "./DashboardView";
import AITraderView from "./AITraderView";
import MarketsView from "./MarketsView";
import TradesView from "./TradesView";
import WithdrawalView from "./WithdrawalView";
import SettingsView from "./SettingsView";
import AdminView from "./AdminView";
import ReasoningModal from "./ReasoningModal";
import LiveEventBanner from "./LiveEventBanner";
import ArchitectureModal from "./ArchitectureModal";
import {
  LayoutDashboard,
  Bot,
  TrendingUp,
  Activity,
  Wallet,
  Sliders,
  Terminal,
  Layers,
  HelpCircle,
  Menu,
  X,
  RotateCcw,
  ShieldCheck,
  Cpu,
  Sparkles,
  Info,
} from "lucide-react";

function NexusTraderInner() {
  const [activeTab, setActiveTab] = useState<string>("Dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [architectureOpen, setArchitectureOpen] = useState(false);

  const {
    balance,
    available,
    config,
    toggleAiTrading,
    openPositions,
    selectedReason,
    isReasonModalOpen,
    closeReasonModal,
    lastEvent,
    resetDemoBalance,
  } = useTradingEngine();

  const navItems = [
    { id: "Dashboard", label: "Dashboard", icon: LayoutDashboard },
    {
      id: "AI Trader",
      label: "AI Trader",
      icon: Bot,
      badge: config.aiEnabled ? "ACTIVE" : undefined,
    },
    { id: "Markets", label: "Markets", icon: TrendingUp },
    {
      id: "Trades",
      label: "Trades",
      icon: Activity,
      badge: openPositions.length > 0 ? `${openPositions.length}` : undefined,
    },
    { id: "Withdrawal", label: "Withdrawal", icon: Wallet },
  ];

  const systemItems = [
    { id: "Settings", label: "Settings", icon: Sliders },
    { id: "Admin", label: "Admin & Telemetry", icon: Terminal },
  ];

  return (
    <div className="min-h-screen bg-[#06100e] text-[#eef6f4] flex">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex w-64 flex-col fixed inset-y-0 left-0 bg-[#081512] border-r border-[#152e28] z-30">
        {/* Brand */}
        <div className="p-6 border-b border-[#142d27]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#143b2f] to-[#22d3a0] flex items-center justify-center font-black text-[#04140f] text-lg shadow-md shadow-[#22d3a0]/20">
              ⚡
            </div>
            <div>
              <div className="font-black text-sm tracking-wider text-[#eef6f4]">
                NEXUS AI
              </div>
              <div className="text-[9px] font-mono tracking-widest text-[#558277] uppercase">
                QUANT TRADER
              </div>
            </div>
          </div>

          <div className="mt-4 p-2.5 rounded-lg bg-[#0c1e19] border border-[#17382f] flex items-center justify-between text-xs">
            <span className="text-[#6e8e86] font-medium">DEMO BALANCE</span>
            <span className="font-mono font-bold text-[#22d3a0]">
              ${balance.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
          <div>
            <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#496e64] px-3 mb-2">
              WORKSPACE
            </div>
            <div className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? "bg-[#143b2f] text-[#3fe7b8] border border-[#216652] shadow-sm"
                        : "text-[#71928a] hover:bg-[#0d1e19] hover:text-[#c4ded6]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </div>

                    {item.badge && (
                      <span
                        className={`text-[9px] px-2 py-0.5 rounded-full font-mono font-bold ${
                          item.badge === "ACTIVE"
                            ? "bg-[#184638] text-[#22d3a0] animate-pulse"
                            : "bg-[#18352d] text-[#c6ded8]"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#496e64] px-3 mb-2">
              SYSTEM & LOGS
            </div>
            <div className="space-y-1">
              {systemItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? "bg-[#143b2f] text-[#3fe7b8] border border-[#216652]"
                        : "text-[#71928a] hover:bg-[#0d1e19] hover:text-[#c4ded6]"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}

              <button
                onClick={() => setArchitectureOpen(true)}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-[#71928a] hover:bg-[#0d1e19] hover:text-[#38bdf8] transition-all"
              >
                <Layers className="w-4 h-4 text-[#38bdf8]" />
                <span>Architecture (Sec 6-7)</span>
              </button>
            </div>
          </div>
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-[#142d27] bg-[#071310] space-y-2">
          <div className="flex items-center gap-2 text-[11px] text-[#708e86]">
            <span className="w-2 h-2 rounded-full bg-[#22d3a0]" />
            <span>Simulated Engine v2.8.4</span>
          </div>
          <div className="text-[10px] text-[#4d6b63]">
            Demo sandbox · Prototype non-funds
          </div>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="h-16 border-b border-[#152e28] bg-[#081512]/90 backdrop-blur-md sticky top-0 z-20 px-4 sm:px-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Mobile menu trigger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-[#71928a] hover:bg-[#0d1e19]"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>

            {/* Markets Status */}
            <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-[#789990]">
              <span className="w-2 h-2 rounded-full bg-[#22d3a0] animate-pulse" />
              <span>MARKETS OPEN</span>
              <span className="text-[#3a5850]">·</span>
              <span>LONDON / NEW YORK SESSIONS</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* AI Status Quick Pill */}
            <button
              onClick={() => toggleAiTrading()}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold font-mono transition-all border ${
                config.aiEnabled
                  ? "bg-[#143d31] text-[#22d3a0] border-[#22d3a0]/40 shadow-sm shadow-[#22d3a0]/20"
                  : "bg-[#14201d] text-[#6d8a82] border-[#233530]"
              }`}
              title="Click to toggle AI Trading"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  config.aiEnabled ? "bg-[#22d3a0]" : "bg-[#557169]"
                }`}
              />
              <span>AI: {config.aiEnabled ? "ACTIVE" : "OFF"}</span>
            </button>

            {/* Demo Balance Header Pill */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0d1e1a] border border-[#16382f] text-xs">
              <span className="text-[#6e8e86]">Available:</span>
              <span className="font-mono font-bold text-[#22d3a0]">
                ${available.toFixed(2)}
              </span>
            </div>

            {/* Reset button */}
            <button
              onClick={resetDemoBalance}
              className="p-2 rounded-lg text-[#6e8e86] hover:text-[#ff6470] hover:bg-[#1f1517] transition-colors"
              title="Reset Demo Balance to $500.00"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Architecture Modal Button */}
            <button
              onClick={() => setArchitectureOpen(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#11242d] hover:bg-[#16303c] text-[#38bdf8] border border-[#1f485f] text-xs font-bold transition-colors"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Architecture</span>
            </button>

            {/* User Avatar / Profile */}
            <div className="flex items-center gap-2 pl-3 border-l border-[#152e28]">
              <div className="w-8 h-8 rounded-full bg-[#143b2f] border border-[#216652] text-[#22d3a0] flex items-center justify-center font-bold text-xs">
                JT
              </div>
              <div className="hidden xl:block text-left text-xs leading-tight">
                <div className="font-bold text-[#eef6f4]">Demo Trader</div>
                <div className="text-[10px] text-[#55776f]">Prototype Access</div>
              </div>
            </div>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden p-4 bg-[#081512] border-b border-[#152e28] space-y-2 animate-slide-down">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-lg text-xs font-bold ${
                    activeTab === item.id
                      ? "bg-[#143b2f] text-[#3fe7b8]"
                      : "text-[#71928a]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-[#184638] text-[#22d3a0]">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
            <div className="pt-2 border-t border-[#142d27]">
              {systemItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg text-xs font-bold ${
                      activeTab === item.id
                        ? "bg-[#143b2f] text-[#3fe7b8]"
                        : "text-[#71928a]"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Content Body */}
        <main className="p-4 sm:p-8 flex-1 max-w-7xl w-full mx-auto">
          {activeTab === "Dashboard" && (
            <DashboardView onNavigate={(tab) => setActiveTab(tab)} />
          )}
          {activeTab === "AI Trader" && <AITraderView />}
          {activeTab === "Markets" && <MarketsView />}
          {activeTab === "Trades" && <TradesView />}
          {activeTab === "Withdrawal" && <WithdrawalView />}
          {activeTab === "Settings" && <SettingsView />}
          {activeTab === "Admin" && <AdminView />}
        </main>
      </div>

      {/* Real-time Popups / Modals */}
      <LiveEventBanner event={lastEvent} />
      <ReasoningModal
        reason={selectedReason}
        isOpen={isReasonModalOpen}
        onClose={closeReasonModal}
      />
      <ArchitectureModal
        isOpen={architectureOpen}
        onClose={() => setArchitectureOpen(false)}
      />
    </div>
  );
}

export default function NexusTraderApp() {
  return (
    <TradingEngineProvider>
      <NexusTraderInner />
    </TradingEngineProvider>
  );
}
