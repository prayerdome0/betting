"use client";

import React, { useState } from "react";
import { useTradingEngine } from "@/lib/simulation/TradingEngineContext";
import { Trade } from "@/types/trading";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  CheckCircle2,
  XCircle,
  Eye,
  Download,
  Filter,
  BarChart3,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Sparkles,
} from "lucide-react";

export default function TradesView() {
  const {
    openPositions,
    closedTrades,
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
    openReasonModal,
    closePosition,
    fastForwardTrades,
  } = useTradingEngine();

  const [mainTab, setMainTab] = useState<"HISTORY" | "OPEN">("HISTORY");
  const [filterType, setFilterType] = useState<"ALL" | "WINS" | "LOSSES">("ALL");

  const filteredClosed = closedTrades.filter((t) => {
    if (filterType === "WINS") return t.isWin;
    if (filterType === "LOSSES") return !t.isWin;
    return true;
  });

  // Export CSV function
  const handleExportCSV = () => {
    const headers = [
      "ID",
      "Symbol",
      "Side",
      "Amount",
      "Entry Price",
      "Exit Price",
      "Realized PnL",
      "PnL Percent",
      "Duration",
      "Close Reason",
      "Outcome",
      "Close Time",
    ];

    const rows = closedTrades.map((t) => [
      t.id,
      t.symbol,
      t.side,
      t.amount,
      t.entryPrice,
      t.exitPrice,
      t.pnl,
      `${t.pnlPercent}%`,
      t.duration,
      t.closeReason,
      t.isWin ? "WIN" : "LOSS",
      t.closeTime,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `nexus_ai_trades_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header & Performance Banner */}
      <div className="rounded-xl bg-[#091518] border border-[#17302b] p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold tracking-wider text-[#7ea399] uppercase">
                QUANTITATIVE TRADE AUDIT
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#16362e] text-[#4ee4b8] font-mono">
                SIMULATION LEDGER
              </span>
            </div>
            <h2 className="text-xl font-bold text-[#eef6f4] mt-1">
              Simulated Positions & Trade History
            </h2>
            <p className="text-xs text-[#6e8e86] mt-0.5">
              Transparent trade execution records with multi-timeframe AI reasoning
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fastForwardTrades(5)}
              className="px-3.5 py-2 rounded-xl bg-[#122e26] hover:bg-[#1a3d34] text-[#3ee7b8] border border-[#235848] text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Simulate 5 Trades</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 rounded-xl bg-[#0b1715] hover:bg-[#132822] text-[#c6ded8] border border-[#18362f] text-xs font-semibold transition-all flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Calculated Performance Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-5 border-t border-[#142d27] text-xs">
          <div className="p-3 rounded-lg bg-[#0b1715] border border-[#16332c]">
            <span className="text-[#6e8e86] block text-[10px] uppercase font-bold">
              Total Trades
            </span>
            <span className="text-lg font-black font-mono text-[#eef6f4] mt-0.5 block">
              {totalTrades}
            </span>
            <span className="text-[10px] text-[#55756d]">
              {winningTrades}W · {losingTrades}L
            </span>
          </div>

          <div className="p-3 rounded-lg bg-[#0b1715] border border-[#16332c]">
            <span className="text-[#6e8e86] block text-[10px] uppercase font-bold">
              Calculated Win Rate
            </span>
            <span className="text-lg font-black font-mono text-[#22d3a0] mt-0.5 block">
              {actualWinRate}%
            </span>
            <span className="text-[10px] text-[#55756d]">
              Dynamic execution
            </span>
          </div>

          <div className="p-3 rounded-lg bg-[#0b1715] border border-[#16332c]">
            <span className="text-[#6e8e86] block text-[10px] uppercase font-bold">
              Net Simulated P/L
            </span>
            <span
              className={`text-lg font-black font-mono mt-0.5 block ${
                netPnL >= 0 ? "text-[#22d3a0]" : "text-[#ff6470]"
              }`}
            >
              {netPnL >= 0 ? "+" : ""}
              ${netPnL.toFixed(2)}
            </span>
            <span className="text-[10px] text-[#55756d]">
              From $500 baseline
            </span>
          </div>

          <div className="p-3 rounded-lg bg-[#0b1715] border border-[#16332c]">
            <span className="text-[#6e8e86] block text-[10px] uppercase font-bold">
              Profit Factor
            </span>
            <span className="text-lg font-black font-mono text-[#38bdf8] mt-0.5 block">
              {profitFactor}
            </span>
            <span className="text-[10px] text-[#55756d]">
              Win/Loss ratio
            </span>
          </div>

          <div className="p-3 rounded-lg bg-[#0b1715] border border-[#16332c]">
            <span className="text-[#6e8e86] block text-[10px] uppercase font-bold">
              Avg Win
            </span>
            <span className="text-lg font-black font-mono text-[#22d3a0] mt-0.5 block">
              +${avgWin.toFixed(2)}
            </span>
            <span className="text-[10px] text-[#55756d]">
              Gross: +${grossProfit.toFixed(2)}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-[#0b1715] border border-[#16332c]">
            <span className="text-[#6e8e86] block text-[10px] uppercase font-bold">
              Avg Loss
            </span>
            <span className="text-lg font-black font-mono text-[#ff6470] mt-0.5 block">
              -${avgLoss.toFixed(2)}
            </span>
            <span className="text-[10px] text-[#55756d]">
              Gross: -${grossLoss.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Main Tab Toggle: History vs Open Positions */}
        <div className="flex items-center gap-1.5 bg-[#0b1715] p-1 rounded-xl border border-[#16332c]">
          <button
            onClick={() => setMainTab("HISTORY")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              mainTab === "HISTORY"
                ? "bg-[#184638] text-[#3ee7b8] shadow-sm"
                : "text-[#62827a] hover:text-[#c4dbd4]"
            }`}
          >
            Closed Trade History ({closedTrades.length})
          </button>
          <button
            onClick={() => setMainTab("OPEN")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              mainTab === "OPEN"
                ? "bg-[#184638] text-[#3ee7b8] shadow-sm"
                : "text-[#62827a] hover:text-[#c4dbd4]"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#22d3a0]" />
            Open Positions ({openPositions.length})
          </button>
        </div>

        {/* Filter for History tab */}
        {mainTab === "HISTORY" && (
          <div className="flex items-center gap-1 bg-[#0b1715] p-1 rounded-xl border border-[#16332c]">
            <span className="text-[11px] text-[#6e8e86] px-2 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Filter:
            </span>
            {(["ALL", "WINS", "LOSSES"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilterType(f)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  filterType === f
                    ? "bg-[#184638] text-[#3ee7b8]"
                    : "text-[#62827a] hover:text-[#c4dbd4]"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Table Content */}
      {mainTab === "HISTORY" ? (
        <div className="rounded-xl bg-[#091518] border border-[#17302b] shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0b1715] text-[#6b8b83] font-bold border-b border-[#16332c]">
                <tr>
                  <th className="p-3.5 pl-5">TRADE ID</th>
                  <th className="p-3.5">ASSET / PAIR</th>
                  <th className="p-3.5">SIDE</th>
                  <th className="p-3.5">SIZE</th>
                  <th className="p-3.5">ENTRY PRICE</th>
                  <th className="p-3.5">EXIT PRICE</th>
                  <th className="p-3.5">RESULT</th>
                  <th className="p-3.5">DURATION</th>
                  <th className="p-3.5">EXIT REASON</th>
                  <th className="p-3.5 pr-5 text-right">AI REASONING</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#152e28]">
                {filteredClosed.map((tr) => {
                  const isBuy = tr.side === "BUY";
                  return (
                    <tr key={tr.id} className="hover:bg-[#0c1a17]">
                      <td className="p-3.5 pl-5 font-mono text-[#6e8e86]">
                        {tr.id}
                      </td>
                      <td className="p-3.5">
                        <div className="font-bold text-[#eef6f4] font-mono">
                          {tr.symbol}
                        </div>
                        <div className="text-[10px] text-[#6e8e86]">
                          {tr.name}
                        </div>
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                            isBuy
                              ? "bg-[#143d31] text-[#22d3a0]"
                              : "bg-[#3e191d] text-[#ff6470]"
                          }`}
                        >
                          {tr.side}
                        </span>
                      </td>
                      <td className="p-3.5 font-mono text-[#c6ded8]">
                        ${tr.amount.toFixed(2)}
                      </td>
                      <td className="p-3.5 font-mono text-[#c6ded8]">
                        {tr.entryPrice}
                      </td>
                      <td className="p-3.5 font-mono text-[#c6ded8]">
                        {tr.exitPrice}
                      </td>
                      <td className="p-3.5 font-mono font-bold">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs ${
                            tr.isWin
                              ? "bg-[#123627] text-[#22d3a0] border border-[#206349]"
                              : "bg-[#361519] text-[#ff6470] border border-[#6b222b]"
                          }`}
                        >
                          {tr.isWin ? "+" : ""}
                          ${tr.pnl.toFixed(2)} ({tr.isWin ? "+" : ""}
                          {tr.pnlPercent.toFixed(1)}%)
                        </span>
                      </td>
                      <td className="p-3.5 text-[#7ea198] font-mono">
                        {tr.duration}
                      </td>
                      <td className="p-3.5 text-[#a2c3bc]">
                        <span className="px-2 py-0.5 rounded bg-[#0d1f1a] text-[10px] font-mono">
                          {tr.closeReason}
                        </span>
                      </td>
                      <td className="p-3.5 pr-5 text-right">
                        <button
                          onClick={() => openReasonModal(tr.reasoning)}
                          className="px-3 py-1.5 rounded-lg bg-[#133028] hover:bg-[#1a4438] text-[#22d3a0] font-bold text-xs transition-colors flex items-center gap-1 ml-auto"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>[VIEW REASON]</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Open Positions Tab */
        <div className="rounded-xl bg-[#091518] border border-[#17302b] shadow-xl overflow-hidden">
          {openPositions.length === 0 ? (
            <div className="p-12 text-center text-[#6e8e86]">
              <p className="text-sm font-semibold">No positions currently open.</p>
              <p className="text-xs text-[#52746b] mt-1">
                Enable AI Trading or trigger a simulated trade from the AI Trader tab.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0b1715] text-[#6b8b83] font-bold border-b border-[#16332c]">
                  <tr>
                    <th className="p-3.5 pl-5">POSITION</th>
                    <th className="p-3.5">SIDE</th>
                    <th className="p-3.5">SIZE</th>
                    <th className="p-3.5">ENTRY</th>
                    <th className="p-3.5">CURRENT</th>
                    <th className="p-3.5">STOP LOSS</th>
                    <th className="p-3.5">TAKE PROFIT</th>
                    <th className="p-3.5">FLOATING P/L</th>
                    <th className="p-3.5 pr-5 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#152e28]">
                  {openPositions.map((pos) => {
                    const isBuy = pos.side === "BUY";
                    return (
                      <tr key={pos.id} className="hover:bg-[#0c1a17]">
                        <td className="p-3.5 pl-5 font-mono font-bold text-[#eef6f4]">
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
                            onClick={() =>
                              closePosition(pos.id, "MANUAL_CLOSE")
                            }
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
      )}
    </div>
  );
}
