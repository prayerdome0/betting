"use client";

import { useState } from "react";

type Mode = "PAPER" | "DEMO" | "LIVE";
type Signal = { pair: string; name: string; price: string; change: string; signal: "BUY" | "SELL" | "WAIT"; score: number };

const markets: Signal[] = [
  { pair: "EUR/USD", name: "Euro / US Dollar", price: "1.1842", change: "+0.28%", signal: "BUY", score: 86 },
  { pair: "GBP/USD", name: "British Pound / US Dollar", price: "1.3418", change: "+0.11%", signal: "BUY", score: 78 },
  { pair: "XAU/USD", name: "Gold / US Dollar", price: "3,682.40", change: "−0.42%", signal: "WAIT", score: 58 },
  { pair: "BTC/USD", name: "Bitcoin / US Dollar", price: "112,480", change: "−1.24%", signal: "SELL", score: 81 },
  { pair: "USD/JPY", name: "US Dollar / Japanese Yen", price: "147.62", change: "+0.06%", signal: "WAIT", score: 64 },
];

const nav = ["Overview", "Market scanner", "Signals", "Positions", "Trade history", "Analytics"];

function Sparkline({ down = false }: { down?: boolean }) {
  const points = down ? "0,8 12,4 24,11 38,8 51,18 65,15 80,26 96,22 110,30" : "0,27 13,24 25,28 39,17 51,20 66,11 80,15 96,5 110,8";
  return <svg viewBox="0 0 110 34" className={down ? "spark down" : "spark"}><polyline points={points} /></svg>;
}

function StatusDot({ amber = false }: { amber?: boolean }) {
  return <span className={amber ? "status-dot amber" : "status-dot"} />;
}

export default function BettingApp() {
  const [active, setActive] = useState("Overview");
  const [mode, setMode] = useState<Mode>("PAPER");
  const [running, setRunning] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 2600);
  };

  return (
    <main className="trader-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">X</span><div><b>X-TRADER</b><small>AI COMMAND CENTER</small></div></div>
        <nav>
          <p className="nav-label">WORKSPACE</p>
          {nav.map((item, i) => <button key={item} className={active === item ? "nav-item active" : "nav-item"} onClick={() => { setActive(item); flash(`${item} view selected`); }}><span>{["⌂", "⌁", "◈", "▣", "↻", "⌁"][i]}</span>{item}{item === "Signals" && <em>3</em>}</button>)}
          <p className="nav-label second">SYSTEM</p>
          {[["AI strategy", "✦"], ["Risk controls", "◇"], ["Backtesting", "◫"], ["Settings", "⚙"]].map(([item, icon]) => <button key={item} className="nav-item" onClick={() => flash(`${item} opened`)}><span>{icon}</span>{item}</button>)}
        </nav>
        <div className="sidebar-foot"><div className="system-line"><StatusDot /><span>All systems operational</span></div><small>Engine v1.4.2 · Paper environment</small></div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-mark">X</span><b>X-TRADER</b></div>
          <div className="market-open"><StatusDot /> MARKETS OPEN <span>•</span> LONDON / NEW YORK</div>
          <div className="top-actions"><button className="icon-btn">⌕</button><button className="icon-btn bell">♢<i /></button><button className="profile"><span>JT</span><div><b>James Taylor</b><small>Administrator</small></div><strong>⌄</strong></button></div>
        </header>

        <div className="content">
          <div className="page-heading"><div><p className="eyebrow">MONDAY, SEPTEMBER 21</p><h1>Command overview</h1><p>Your autonomous trading system is monitoring 7 markets.</p></div><div className="mode-control"><label>TRADING MODE</label><div>{(["PAPER", "DEMO", "LIVE"] as Mode[]).map(m => <button key={m} className={mode === m ? "selected" : ""} onClick={() => { setMode(m); flash(`${m} mode selected${m === "LIVE" ? " — confirmation required before orders" : ""}`); }}>{m}</button>)}</div></div></div>

          <section className="hero-grid">
            <div className="balance-card panel"><div className="card-top"><span>PORTFOLIO BALANCE</span><button>•••</button></div><h2>$10,248.60</h2><p><strong>+$248.60</strong> <span>+2.49% all time</span></p><div className="chart"><svg viewBox="0 0 500 100" preserveAspectRatio="none"><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#24d6a0" stopOpacity=".24"/><stop offset="1" stopColor="#24d6a0" stopOpacity="0"/></linearGradient></defs><path className="area" d="M0 79 C35 77 40 61 75 67 S115 50 145 57 S185 73 215 48 S255 61 282 42 S325 50 350 31 S385 39 412 22 S455 31 500 8 L500 100 L0 100Z"/><path className="line" d="M0 79 C35 77 40 61 75 67 S115 50 145 57 S185 73 215 48 S255 61 282 42 S325 50 350 31 S385 39 412 22 S455 31 500 8"/></svg></div><div className="chart-labels"><span>9:00</span><span>11:00</span><span>13:00</span><span>15:00</span><span>NOW</span></div></div>
            <div className="metric panel"><span>TODAY&apos;S P/L</span><h3>+$42.80</h3><p className="positive">↗ 0.42%</p><small>Realized +$28.40<br/>Unrealized +$14.40</small></div>
            <div className="metric panel"><span>OPEN POSITIONS</span><h3>2</h3><p>of 4 maximum</p><small>Exposure<br/><b>$1,204.00</b></small></div>
            <div className="metric panel"><span>WIN RATE</span><h3>64.2%</h3><p className="positive">↗ 3.1% this month</p><small>28 wins · 15 losses</small></div>
          </section>

          <section className="main-grid">
            <div className="panel scanner"><div className="section-head"><div><h3>Market scanner</h3><p>Live technical analysis across enabled markets</p></div><button onClick={() => flash("Scanner refreshed with live market data")}>↻ &nbsp;Refresh</button></div>
              <div className="market-table"><div className="table-row table-head"><span>MARKET</span><span>PRICE</span><span>24H</span><span>TREND</span><span>SIGNAL</span><span>SCORE</span></div>{markets.map((m, idx) => <div className="table-row" key={m.pair}><span className="pair"><i>{m.pair.slice(0,2)}</i><b>{m.pair}<small>{m.name}</small></b></span><span className="price">{m.price}</span><span className={m.change.startsWith("+") ? "positive" : "negative"}>{m.change}</span><span><Sparkline down={m.change.startsWith("−")} /></span><span><em className={`signal ${m.signal.toLowerCase()}`}>{m.signal}</em></span><span className="score"><b>{m.score}</b><i><u style={{width:`${m.score}%`}} /></i></span></div>)}</div>
              <button className="view-all">VIEW ALL MARKETS →</button>
            </div>

            <div className="right-stack">
              <div className="panel ai-card"><div className="ai-head"><span className="ai-icon">✦</span><div><h3>AI Engine</h3><p>Strategy analysis & decisioning</p></div><em className={running ? "online" : "paused"}><StatusDot amber={!running}/>{running ? "ACTIVE" : "PAUSED"}</em></div><div className="ai-stats"><div><span>Markets scanning</span><b>{running ? 7 : 0}</b></div><div><span>Signals today</span><b>12</b></div><div><span>Trades approved</span><b>3</b></div></div><div className="analysis"><div><span>LATEST ANALYSIS</span><small>2 min ago</small></div><h4>EUR/USD · 15 MINUTE</h4><p><b>BUY SETUP IDENTIFIED</b><strong>86% confidence</strong></p><blockquote>Trend and momentum align with higher-timeframe structure. Volatility is normal and spread is acceptable.</blockquote><button onClick={() => flash("Opening full EUR/USD analysis")}>View full analysis <span>→</span></button></div></div>
              <div className="panel risk-card"><div className="risk-title"><span>◇</span><div><h3>Risk engine</h3><p>All safeguards enabled</p></div><em><StatusDot />SAFE</em></div>{[["Daily loss", "$0 / $200", "0%"], ["Open exposure", "$1,204 / $2,500", "48%"], ["Trades today", "3 / 8", "38%"]].map(([a,b,w]) => <div className="risk-row" key={a}><p><span>{a}</span><b>{b}</b></p><i><u style={{width:w}} /></i></div>)}</div>
            </div>
          </section>

          <section className="bottom-grid">
            <div className="panel positions"><div className="section-head"><div><h3>Open positions</h3><p>Live trades monitored by the execution engine</p></div><button>View all →</button></div><div className="position"><span className="pair"><i>EU</i><b>EUR/USD<small>BUY · 0.40 lots</small></b></span><span><small>ENTRY</small><b>1.1818</b></span><span><small>CURRENT</small><b>1.1842</b></span><span><small>UNREALIZED P/L</small><b className="positive">+$9.60</b></span><em className="signal buy">RUNNING</em></div><div className="position"><span className="pair"><i>GU</i><b>GBP/USD<small>BUY · 0.25 lots</small></b></span><span><small>ENTRY</small><b>1.3391</b></span><span><small>CURRENT</small><b>1.3418</b></span><span><small>UNREALIZED P/L</small><b className="positive">+$6.75</b></span><em className="signal buy">RUNNING</em></div></div>
            <div className="panel emergency"><span>!</span><div><h3>Emergency control</h3><p>Immediately block all new signals and orders.</p></div><button className={running ? "" : "resume"} onClick={() => { setRunning(!running); flash(running ? "AI trading paused. New orders are blocked." : "AI monitoring resumed in paper mode."); }}>{running ? "■  STOP AI TRADING" : "▶  RESUME AI"}</button></div>
          </section>
          <footer><p><StatusDot /> Market data live · Last update just now</p><span>Paper trading only — figures are simulated and are not financial advice.</span></footer>
        </div>
      </section>
      {notice && <div className="toast">✓ &nbsp;{notice}</div>}
    </main>
  );
}
