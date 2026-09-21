"use client";

import React, { useState } from "react";
import { useTradingEngine } from "@/lib/simulation/TradingEngineContext";
import { Market } from "@/types/trading";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart2,
  Sliders,
  Sparkles,
  Bot,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  ShieldAlert,
} from "lucide-react";

export default function MarketsView() {
  const {
    markets,
    selectedMarket,
    selectMarket,
    openPositions,
    config,
    triggerAiTrade,
  } = useTradingEngine();

  const [timeframe, setTimeframe] = useState<"1M" | "5M" | "15M" | "1H" | "1D">(
    "5M"
  );
  const [chartType, setChartType] = useState<"AREA" | "CANDLES">("AREA");
  const [activeCategory, setActiveCategory] = useState<"ALL" | "Forex" | "Crypto" | "Commodities">("ALL");

  const filteredMarkets =
    activeCategory === "ALL"
      ? markets
      : markets.filter((m) => m.category === activeCategory);

  // Check if there is an open position on the selected market
  const activePos = openPositions.find((p) => p.symbol === selectedMarket.symbol);

  // SVG Chart points generation based on selectedMarket.history
  const history = selectedMarket.history;
  const minVal = Math.min(...history) * 0.999;
  const maxVal = Math.max(...history) * 1.001;
  const range = maxVal - minVal || 1;

  const svgWidth = 600;
  const svgHeight = 220;

  const points = history
    .map((val, idx) => {
      const x = (idx / (history.length - 1)) * svgWidth;
      const y = svgHeight - ((val - minVal) / range) * (svgHeight - 40) - 20;
      return `${x},${y}`;
    })
    .join(" ");

  const firstY =
    svgHeight - ((history[0] - minVal) / range) * (svgHeight - 40) - 20;
  const lastY =
    svgHeight -
    ((history[history.length - 1] - minVal) / range) * (svgHeight - 40) -
    20;

  const areaD = `M0,${firstY} L ${points} L ${svgWidth},${svgHeight} L 0,${svgHeight} Z`;

  return (
    <div className="space-y-6">
      {/* Top Asset Selector & Category Pills */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#eef6f4] flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#22d3a0]" />
            Live Market Terminal
          </h2>
          <p className="text-xs text-[#6e8e86] mt-0.5">
            Streaming price feeds and algorithmic order routing across assets
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-[#0b1715] p-1 rounded-xl border border-[#16332c]">
          {(["ALL", "Forex", "Crypto", "Commodities"] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                activeCategory === cat
                  ? "bg-[#184638] text-[#3ee7b8]"
                  : "text-[#62827a] hover:text-[#c4dbd4]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Main Terminal Grid: Interactive Chart + Order Depth Ladder */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart Card */}
        <div className="lg:col-span-2 rounded-xl bg-[#091518] border border-[#17302b] p-6 shadow-xl flex flex-col justify-between">
          <div>
            {/* Chart Header Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#142d27]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#143d31] text-[#22d3a0] flex items-center justify-center font-black text-sm">
                  {selectedMarket.symbol.slice(0, 2)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-[#eef6f4]">
                      {selectedMarket.symbol}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-[#132c25] text-[#3fe7b8] uppercase font-semibold">
                      {selectedMarket.category}
                    </span>
                  </div>
                  <div className="text-xs text-[#6e8e86]">
                    {selectedMarket.name} · Spread: {selectedMarket.spread} pips
                  </div>
                </div>
              </div>

              {/* Price & Change */}
              <div className="flex items-baseline gap-3">
                <div className="text-2xl font-black font-mono text-[#eef6f4]">
                  {selectedMarket.price.toFixed(selectedMarket.precision)}
                </div>
                <div
                  className={`text-xs font-bold font-mono flex items-center ${
                    selectedMarket.change24h >= 0
                      ? "text-[#22d3a0]"
                      : "text-[#ff6470]"
                  }`}
                >
                  {selectedMarket.change24h >= 0 ? "+" : ""}
                  {selectedMarket.change24h}%
                </div>
              </div>
            </div>

            {/* Timeframe & Chart Controls */}
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-1">
                {(["1M", "5M", "15M", "1H", "1D"] as const).map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                      timeframe === tf
                        ? "bg-[#184638] text-[#3ee7b8]"
                        : "text-[#62827a] hover:bg-[#0f2420]"
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setChartType(chartType === "AREA" ? "CANDLES" : "AREA")
                  }
                  className="px-2.5 py-1 rounded bg-[#102420] text-xs font-semibold text-[#7aa197] hover:text-[#22d3a0] transition-colors"
                >
                  {chartType === "AREA" ? "Area Curve" : "Candles"}
                </button>
              </div>
            </div>

            {/* Interactive SVG Chart */}
            <div className="relative h-64 w-full my-2 bg-[#06100e] rounded-lg border border-[#132824] overflow-hidden p-2">
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="w-full h-full overflow-visible"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="marketGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor={
                        selectedMarket.change24h >= 0 ? "#22d3a0" : "#ff6470"
                      }
                      stopOpacity="0.25"
                    />
                    <stop
                      offset="100%"
                      stopColor={
                        selectedMarket.change24h >= 0 ? "#22d3a0" : "#ff6470"
                      }
                      stopOpacity="0.0"
                    />
                  </linearGradient>
                </defs>

                {/* Grid Lines */}
                <line x1="0" y1="50" x2={svgWidth} y2="50" stroke="#0e231e" strokeDasharray="3 3" />
                <line x1="0" y1="110" x2={svgWidth} y2="110" stroke="#0e231e" strokeDasharray="3 3" />
                <line x1="0" y1="170" x2={svgWidth} y2="170" stroke="#0e231e" strokeDasharray="3 3" />

                {/* Area & Stroke */}
                <path d={areaD} fill="url(#marketGrad)" />
                <polyline
                  points={points}
                  fill="none"
                  stroke={
                    selectedMarket.change24h >= 0 ? "#22d3a0" : "#ff6470"
                  }
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Active Position Overlay Markers */}
                {activePos && (
                  <g>
                    {/* Entry line */}
                    <line
                      x1="0"
                      y1="110"
                      x2={svgWidth}
                      y2="110"
                      stroke="#38bdf8"
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                    />
                    <text x="10" y="105" fill="#38bdf8" fontSize="10" fontWeight="bold">
                      ENTRY: {activePos.entryPrice} ({activePos.side})
                    </text>

                    {/* Take Profit line */}
                    <line
                      x1="0"
                      y1="60"
                      x2={svgWidth}
                      y2="60"
                      stroke="#22d3a0"
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                    />
                    <text x="10" y="55" fill="#22d3a0" fontSize="10" fontWeight="bold">
                      TAKE PROFIT: {activePos.takeProfit}
                    </text>

                    {/* Stop Loss line */}
                    <line
                      x1="0"
                      y1="160"
                      x2={svgWidth}
                      y2="160"
                      stroke="#ff6470"
                      strokeWidth="1.5"
                      strokeDasharray="4 4"
                    />
                    <text x="10" y="155" fill="#ff6470" fontSize="10" fontWeight="bold">
                      STOP LOSS: {activePos.stopLoss}
                    </text>
                  </g>
                )}
              </svg>

              {/* Real-time Indicator overlay badge */}
              <div className="absolute top-3 right-3 flex items-center gap-2 bg-[#091714]/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-[#16362f] text-[11px] font-mono">
                <span className="text-[#6d8d85]">RSI: {selectedMarket.rsi}</span>
                <span className="text-[#3b5e56]">|</span>
                <span className="text-[#22d3a0]">
                  AI Conviction: {selectedMarket.aiScore}%
                </span>
              </div>
            </div>
          </div>

          {/* Technical Indicator Summary Ribbon */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-[#142d27] text-xs">
            <div className="p-2 rounded-lg bg-[#0c1815] border border-[#16332c]">
              <span className="text-[#6e8e86] block text-[10px]">24H HIGH</span>
              <span className="font-mono font-bold text-[#eef6f4]">
                {selectedMarket.high24h.toFixed(selectedMarket.precision)}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-[#0c1815] border border-[#16332c]">
              <span className="text-[#6e8e86] block text-[10px]">24H LOW</span>
              <span className="font-mono font-bold text-[#eef6f4]">
                {selectedMarket.low24h.toFixed(selectedMarket.precision)}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-[#0c1815] border border-[#16332c]">
              <span className="text-[#6e8e86] block text-[10px]">AI SCAN STATUS</span>
              <span className="font-mono font-bold text-[#22d3a0]">
                {selectedMarket.scannerStatus}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-[#0c1815] border border-[#16332c]">
              <span className="text-[#6e8e86] block text-[10px]">RECOMMENDED</span>
              <span
                className={`font-mono font-bold ${
                  selectedMarket.aiSignal === "BUY"
                    ? "text-[#22d3a0]"
                    : selectedMarket.aiSignal === "SELL"
                    ? "text-[#ff6470]"
                    : "text-[#fbbf24]"
                }`}
              >
                {selectedMarket.aiSignal}
              </span>
            </div>
          </div>
        </div>

        {/* Simulated Order Book Depth Ladder */}
        <div className="rounded-xl bg-[#091518] border border-[#17302b] p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#142d27]">
              <div>
                <h3 className="text-sm font-bold text-[#eef6f4]">
                  Simulated Order Depth
                </h3>
                <p className="text-[11px] text-[#6e8e86]">
                  Simulated Level 2 Book
                </p>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#122e26] text-[#22d3a0]">
                ACTIVE FEED
              </span>
            </div>

            {/* Asks (Sells) */}
            <div className="space-y-1.5 my-3 text-xs font-mono">
              {[3, 2, 1].map((step) => {
                const askPrice =
                  selectedMarket.price +
                  (step * selectedMarket.price * 0.0006);
                const size = (0.4 + step * 0.35).toFixed(2);
                return (
                  <div
                    key={`ask-${step}`}
                    className="flex items-center justify-between relative px-2 py-1 rounded bg-[#1e0f12]/30"
                  >
                    <span className="text-[#ff6470] font-bold">
                      {askPrice.toFixed(selectedMarket.precision)}
                    </span>
                    <span className="text-[#8f6e72]">{size} LOTS</span>
                    <div
                      className="absolute right-0 top-0 bottom-0 bg-[#ff6470]/10 rounded"
                      style={{ width: `${30 + step * 20}%` }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Current Spread Bar */}
            <div className="py-2 px-3 my-2 rounded-lg bg-[#0d1e1a] border border-[#16382f] flex items-center justify-between text-xs font-mono">
              <span className="text-[#789d93]">Spread: {selectedMarket.spread} pips</span>
              <span className="font-bold text-[#22d3a0]">
                {selectedMarket.price.toFixed(selectedMarket.precision)}
              </span>
            </div>

            {/* Bids (Buys) */}
            <div className="space-y-1.5 my-3 text-xs font-mono">
              {[1, 2, 3].map((step) => {
                const bidPrice =
                  selectedMarket.price -
                  (step * selectedMarket.price * 0.0006);
                const size = (0.5 + step * 0.3).toFixed(2);
                return (
                  <div
                    key={`bid-${step}`}
                    className="flex items-center justify-between relative px-2 py-1 rounded bg-[#0d221b]/30"
                  >
                    <span className="text-[#22d3a0] font-bold">
                      {bidPrice.toFixed(selectedMarket.precision)}
                    </span>
                    <span className="text-[#648c82]">{size} LOTS</span>
                    <div
                      className="absolute right-0 top-0 bottom-0 bg-[#22d3a0]/10 rounded"
                      style={{ width: `${35 + step * 18}%` }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-[#142d27]">
            <button
              onClick={() => triggerAiTrade(selectedMarket.symbol)}
              className="w-full py-2.5 rounded-lg bg-[#143d31] hover:bg-[#1a4a3c] text-[#22d3a0] text-xs font-bold transition-colors flex items-center justify-center gap-2"
            >
              <Bot className="w-4 h-4" />
              <span>Simulate AI Entry on {selectedMarket.symbol}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Markets Watchlist Table */}
      <div className="rounded-xl bg-[#091518] border border-[#17302b] shadow-xl overflow-hidden">
        <div className="p-5 border-b border-[#16332c] flex items-center justify-between bg-[#0c1a17]">
          <div>
            <h3 className="text-base font-bold text-[#eef6f4] flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#22d3a0]" />
              Multi-Asset Watchlist
            </h3>
            <p className="text-xs text-[#6e8e86] mt-0.5">
              Click any asset row to focus chart and order details
            </p>
          </div>
          <span className="text-xs text-[#708e86] font-mono">
            {filteredMarkets.length} instruments
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0b1715] text-[#6b8b83] font-bold border-b border-[#16332c]">
              <tr>
                <th className="p-3.5 pl-5">ASSET</th>
                <th className="p-3.5">CATEGORY</th>
                <th className="p-3.5">PRICE</th>
                <th className="p-3.5">24H CHANGE</th>
                <th className="p-3.5">24H HIGH / LOW</th>
                <th className="p-3.5">RSI (14)</th>
                <th className="p-3.5">AI STATUS</th>
                <th className="p-3.5 pr-5 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#152e28]">
              {filteredMarkets.map((m) => {
                const isSelected = selectedMarket.symbol === m.symbol;
                return (
                  <tr
                    key={m.symbol}
                    onClick={() => selectMarket(m)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-[#102721] border-l-4 border-[#22d3a0]"
                        : "hover:bg-[#0c1a17]"
                    }`}
                  >
                    <td className="p-3.5 pl-5">
                      <div className="font-bold text-[#eef6f4]">{m.symbol}</div>
                      <div className="text-[10px] text-[#6e8e86]">{m.name}</div>
                    </td>
                    <td className="p-3.5 text-[#7ea198] uppercase font-semibold text-[10px]">
                      {m.category}
                    </td>
                    <td className="p-3.5 font-mono font-bold text-[#eef6f4]">
                      {m.price.toFixed(m.precision)}
                    </td>
                    <td className="p-3.5 font-mono">
                      <span
                        className={`font-bold flex items-center ${
                          m.change24h >= 0 ? "text-[#22d3a0]" : "text-[#ff6470]"
                        }`}
                      >
                        {m.change24h >= 0 ? "+" : ""}
                        {m.change24h}%
                      </span>
                    </td>
                    <td className="p-3.5 font-mono text-[#7ea198]">
                      {m.high24h.toFixed(m.precision)} / {m.low24h.toFixed(m.precision)}
                    </td>
                    <td className="p-3.5 font-mono text-[#a2c3bc]">
                      {m.rsi}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase font-mono ${
                          m.scannerStatus === "WAIT"
                            ? "bg-[#21231d] text-[#eab308]"
                            : m.scannerStatus === "ANALYZING"
                            ? "bg-[#112735] text-[#38bdf8]"
                            : m.scannerStatus === "SIGNAL"
                            ? "bg-[#133c2e] text-[#22d3a0] animate-pulse"
                            : "bg-[#381c30] text-[#f472b6]"
                        }`}
                      >
                        {m.scannerStatus}
                      </span>
                    </td>
                    <td className="p-3.5 pr-5 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          selectMarket(m);
                        }}
                        className="px-2.5 py-1 rounded bg-[#133028] hover:bg-[#1a4438] text-[#22d3a0] font-semibold text-xs transition-colors"
                      >
                        View Chart
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
