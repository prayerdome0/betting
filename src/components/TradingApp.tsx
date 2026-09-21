"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "firebase/auth";
import {
  Activity,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Download,
  ExternalLink,
  Globe2,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  TrendingUp,
  Wallet,
  Waves,
  X,
  Zap,
} from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { useTrading } from "@/lib/useTrading";
import { isEmulator } from "@/lib/firebase";
import { signOutUser } from "@/lib/authActions";
import type {
  Activity as ActivityItem,
  SymbolName,
  Trade,
} from "@/lib/trading/types";
import { SYMBOLS } from "@/lib/trading/types";
import { analyze } from "@/lib/trading/strategy";
import AuthDialog from "./AuthDialog";
import SessionControl from "./SessionControl";
import { SettingsView, WithdrawalView } from "./AccountViews";
import AdminView from "./AdminView";
import SystemStatus from "./SystemStatus";
import {
  Badge,
  Chart,
  date,
  Empty,
  money,
  Modal,
  PanelHead,
  Sparkline,
} from "./ui";
const NAV = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "AI sessions", icon: Bot },
  { name: "Markets", icon: Globe2 },
  { name: "Trade history", icon: ArrowDownLeft },
  { name: "Withdrawals", icon: Wallet },
];
const DESCRIPTIONS: Record<string, string> = {
  Overview: "A clear view of your capital, strategy, and every decision.",
  "AI sessions":
    "Set your strategy in motion. Stay in control of every session.",
  Markets: "Follow the price action across your simulated market universe.",
  "Trade history": "Every decision, execution, and outcome. Nothing hidden.",
  Withdrawals: "Explore the withdrawal workflow with virtual funds only.",
  Settings: "Make this trading environment your own.",
  Admin: "Account activity and system health, with a complete audit trail.",
};
export default function TradingApp() {
  const { user, loading, error } = useAuth();
  return (
    <Workspace
      key={user?.uid || "guest"}
      user={user}
      authLoading={loading}
      authError={error}
    />
  );
}
function Workspace({
  user,
  authLoading,
  authError,
}: {
  user: User | null;
  authLoading: boolean;
  authError: string;
}) {
  const data = useTrading(user);
  const {
    account,
    sessions,
    trades,
    positions,
    activity,
    ledger,
    withdrawals,
    feed,
    health,
    error,
    busy,
    command,
    notice,
    setNotice,
  } = data;
  const [tab, setTab] = useState("Overview");
  const [authOpen, setAuthOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [now, setNow] = useState(0);
  const [admin, setAdmin] = useState(false);
  const [modal, setModal] = useState<"help" | "activity" | null>(null);
  const [trade, setTrade] = useState<Trade | null>(null);
  const [period, setPeriod] = useState("ALL");
  const [selectedMarket, setSelectedMarket] = useState<SymbolName>("EUR/USD");
  const [search, setSearch] = useState("");
  const [tradeFilter, setTradeFilter] = useState("All trades");
  useEffect(() => {
    const update = () => setNow(Date.now() + data.clockOffset);
    const frame = requestAnimationFrame(() => {
      try {
        setDark(localStorage.getItem("nexus-theme") === "dark");
      } catch {}
      update();
    });
    const t = setInterval(update, 1000);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(t);
    };
  }, [data.clockOffset]);
  useEffect(() => {
    if (user)
      void user
        .getIdTokenResult()
        .then((t) => setAdmin(t.claims.admin === true));
  }, [user]);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 6500);
    return () => clearTimeout(t);
  }, [notice, setNotice]);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setModal(null);
        setTrade(null);
        setAuthOpen(false);
        setMobileOpen(false);
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, []);
  function navigate(next: string) {
    setTab(next);
    setMobileOpen(false);
  }
  const current =
    sessions.find((s) => s.id === account?.activeSessionId) || null;
  const latest = current || sessions[0] || null;
  const activeSettings = current?.settings || account?.settings;
  const online =
    data.browserOnline &&
    (!user || data.connected) &&
    !!health?.workerOnline &&
    !!health?.feedFresh;
  const openPnl = positions.reduce((sum, p) => sum + p.pnlCents, 0);
  const available = account
    ? account.balanceCents - account.reservedCents - account.withdrawalHoldCents
    : null;
  const today = account
    ? account.pnlDay === new Date(now).toISOString().slice(0, 10)
      ? account.todayPnlCents
      : 0
    : null;
  const winRate = account?.trades
    ? ((account.wins / account.trades) * 100).toFixed(1)
    : null;
  const chartPoints = [...ledger]
    .reverse()
    .filter(
      (l) =>
        period === "ALL" ||
        l.timestamp >= now - (period === "1H" ? 3600000 : 86400000),
    )
    .map((l) => ({ time: l.timestamp, value: l.balanceAfterCents / 100 }));
  const visibleTrades = (
    tradeFilter === "Open positions" ? positions : trades
  ).filter(
    (t) =>
      (tradeFilter === "All trades" ||
        (tradeFilter === "Open positions" && t.status === "OPEN") ||
        (tradeFilter === "Winning" && t.result === "WIN") ||
        (tradeFilter === "Losing" && t.result === "LOSS")) &&
      `${t.market} ${t.id} ${t.side}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  function exportTrades() {
    const headers = [
      "Trade ID",
      "Session ID",
      "Market",
      "Side",
      "Entry",
      "Exit",
      "Amount USD",
      "Net P/L USD",
      "Fees USD",
      "Result",
      "Opened UTC",
      "Closed UTC",
      "Strategy version",
      "Decision reason",
    ];
    const rows = visibleTrades.map((t) => [
      t.id,
      t.sessionId,
      t.market,
      t.side,
      t.entryPrice,
      t.exitPrice ?? "",
      t.amountCents / 100,
      t.pnlCents / 100,
      t.feesCents / 100,
      t.result || "OPEN",
      new Date(t.startedAt).toISOString(),
      t.endedAt ? new Date(t.endedAt).toISOString() : "",
      t.strategyVersion,
      t.reason,
    ]);
    const csv = [headers, ...rows]
      .map((r) =>
        r.map((x) => `"${String(x).replaceAll('"', '""')}"`).join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "nexus-simulated-trades.csv";
    link.click();
    URL.revokeObjectURL(url);
  }
  const sessionCard = (
    <SessionControl
      session={latest}
      account={account}
      now={now}
      busy={busy}
      command={command}
      signIn={() => (user ? navigate("Settings") : setAuthOpen(true))}
      online={online}
    />
  );
  function marketTable() {
    return (
      <div className="table-scroll">
        <table className="markets-table">
          <thead>
            <tr>
              <th>Market</th>
              <th>Price</th>
              <th>Window change</th>
              <th>Price trend</th>
              <th>AI decision</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {SYMBOLS.map((symbol, index) => {
              const quote = feed?.quotes.find((q) => q.symbol === symbol);
              const analysis = quote
                ? analyze(
                    quote,
                    current?.settings.strategy ||
                      account?.settings.strategy ||
                      "MOMENTUM",
                  )
                : null;
              const selected = account?.settings.markets.includes(symbol);
              const active =
                !!current &&
                current.status === "ACTIVE" &&
                online &&
                current.settings.markets.includes(symbol);
              const position = positions.some((p) => p.market === symbol);
              return (
                <tr
                  key={symbol}
                  onClick={() => {
                    setSelectedMarket(symbol);
                    navigate("Markets");
                  }}
                >
                  <td>
                    <button
                      className="market-name"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedMarket(symbol);
                        navigate("Markets");
                      }}
                    >
                      <span className={`asset-icon asset-${index}`}>
                        {["€", "£", "Au", "₿"][index]}
                      </span>
                      <span>
                        <strong>{symbol}</strong>
                        <small>
                          {
                            [
                              "Euro / US Dollar",
                              "British Pound / US Dollar",
                              "Gold / US Dollar",
                              "Bitcoin / US Dollar",
                            ][index]
                          }
                        </small>
                      </span>
                    </button>
                  </td>
                  <td className="numeric">
                    {quote
                      ? quote.price.toLocaleString("en-US", {
                          minimumFractionDigits: quote.precision,
                          maximumFractionDigits: quote.precision,
                        })
                      : "—"}
                  </td>
                  <td
                    className={
                      quote && quote.changePct < 0 ? "negative" : "positive"
                    }
                  >
                    {quote
                      ? `${quote.changePct >= 0 ? "+" : ""}${quote.changePct.toFixed(2)}%`
                      : "—"}
                  </td>
                  <td>
                    <Sparkline
                      points={quote?.history.map((p) => p.price) || []}
                      negative={!!quote && quote.changePct < 0}
                    />
                  </td>
                  <td>
                    <span
                      className={`decision ${analysis?.decision.toLowerCase() || "wait"}`}
                    >
                      {active ? analysis?.decision || "WAIT" : "—"}
                    </span>
                  </td>
                  <td>
                    <span className={`market-status ${active ? "on" : ""}`}>
                      <i />
                      {position
                        ? "MONITORING"
                        : !account
                          ? "NOT CONNECTED"
                          : !selected
                            ? "NOT SELECTED"
                            : !online
                              ? "FEED OFFLINE"
                              : active
                                ? analysis?.decision === "WAIT"
                                  ? "ANALYZING"
                                  : "SIGNAL"
                                : "WAIT"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }
  function tradeTable(items: Trade[]) {
    return items.length ? (
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Market / side</th>
              <th>Entry → exit</th>
              <th>Allocation</th>
              <th>Net P/L</th>
              <th>Status</th>
              <th>Opened</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.id}>
                <td>
                  <strong>{t.market}</strong>
                  <span className={`side-label ${t.side.toLowerCase()}`}>
                    {t.side}
                  </span>
                </td>
                <td className="mono">
                  {t.entryPrice.toLocaleString("en-US", {
                    maximumFractionDigits: 5,
                  })}
                  <span className="muted"> → </span>
                  {t.exitPrice?.toLocaleString("en-US", {
                    maximumFractionDigits: 5,
                  }) || "Open"}
                </td>
                <td>{money(t.amountCents)}</td>
                <td className={t.pnlCents < 0 ? "negative" : "positive"}>
                  {money(t.pnlCents, true)}
                  {t.status === "OPEN" && <small>Unrealized</small>}
                </td>
                <td>
                  <Badge
                    tone={
                      t.status === "OPEN"
                        ? "green"
                        : t.result === "LOSS"
                          ? "red"
                          : "neutral"
                    }
                  >
                    {t.status === "OPEN"
                      ? "MONITORING"
                      : t.result?.replace("_", " ")}
                  </Badge>
                </td>
                <td>{date(t.startedAt)}</td>
                <td>
                  <button
                    className="icon-button"
                    aria-label={`Inspect trade ${t.id}`}
                    onClick={() => setTrade(t)}
                  >
                    <ArrowUpRight size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <Empty
        title={
          user
            ? "Your trading story starts here"
            : "Your trades, all in one place"
        }
        text={
          user
            ? "Start an AI session to see real simulation results. Both wins and losses are recorded."
            : "Sign in to track positions, review decisions, and build your trading history."
        }
        icon={<BarChart3 size={27} />}
      />
    );
  }
  return (
    <div className="app-shell">
      {mobileOpen && (
        <div className="nav-overlay" onClick={() => setMobileOpen(false)} />
      )}
      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <Link className="brand" href="/" aria-label="Nexus overview">
          <span className="brand-mark">
            <Waves size={25} />
          </span>
          <span>
            NEXUS<span className="brand-ai">AI</span>
            <small>THE INTELLIGENT EDGE</small>
          </span>
        </Link>
        <div className="workspace-label">
          <span className="workspace-square">N</span>
          <div>
            Personal workspace<small>Simulation account</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <span className="nav-label">WORKSPACE</span>
        <nav>
          {NAV.map((n) => (
            <button
              key={n.name}
              className={`nav-item ${tab === n.name ? "active" : ""}`}
              onClick={() => navigate(n.name)}
            >
              <n.icon size={18} />
              <span>{n.name}</span>
              {n.name === "AI sessions" && current ? (
                <span className="nav-count">1</span>
              ) : n.name === "Trade history" && account?.trades ? (
                <span className="nav-count">{account.trades}</span>
              ) : null}
              {tab === n.name && <span className="nav-active-dot" />}
            </button>
          ))}
        </nav>
        <span className="nav-label tools-label">PREFERENCES</span>
        <button
          className={`nav-item ${tab === "Settings" ? "active" : ""}`}
          onClick={() => navigate("Settings")}
        >
          <Settings2 size={18} />
          <span>Settings</span>
        </button>
        {admin && (
          <button
            className={`nav-item ${tab === "Admin" ? "active" : ""}`}
            onClick={() => navigate("Admin")}
          >
            <ShieldCheck size={18} />
            <span>Admin & system</span>
          </button>
        )}
        <button className="nav-item" onClick={() => setModal("help")}>
          <CircleHelp size={18} />
          <span>How it works</span>
        </button>
        <div className="sidebar-bottom">
          <div className="practice-card">
            <div>
              <ShieldCheck size={18} />
              <span>Built for practice.</span>
            </div>
            <p>
              Real discipline.
              <br />
              Zero real-money risk.
            </p>
            <span className="outline-badge">100% SIMULATION</span>
          </div>
          <div className="sidebar-system">
            <i className={online ? "online" : ""} />
            <div>
              {online ? "Simulation worker online" : "Simulation environment"}
              <small>
                {isEmulator
                  ? "Local Firebase emulators"
                  : "Firebase-powered persistence"}
              </small>
            </div>
            <ExternalLink size={12} />
          </div>
        </div>
      </aside>
      <div className="main-workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button menu-button"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle navigation"
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <b>{tab}</b>
          </div>
          <div className="topbar-actions">
            <span className="environment-label">
              <span />
              SIMULATION MODE
            </span>
            <div className="top-divider" />
            <button
              className="icon-button"
              aria-label={
                dark ? "Switch to light theme" : "Switch to dark theme"
              }
              onClick={() => {
                setDark(!dark);
                localStorage.setItem("nexus-theme", !dark ? "dark" : "light");
              }}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              className="icon-button notifications"
              aria-label="View activity log"
              onClick={() => setModal("activity")}
            >
              <Bell size={18} />
              {activity.length > 0 && <i />}
            </button>
            {user ? (
              <button
                className="avatar"
                onClick={() => navigate("Settings")}
                aria-label="Open account settings"
              >
                {(account?.name || user.email || "N").slice(0, 2).toUpperCase()}
              </button>
            ) : (
              <button
                className="button top-signin"
                onClick={() => setAuthOpen(true)}
              >
                {authLoading ? "Connecting…" : "Sign in"}
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        </header>
        <main className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <span /> YOUR TRADING COMMAND CENTER
              </div>
              <h1>
                {tab === "Overview"
                  ? "Trading overview"
                  : tab === "AI sessions"
                    ? "Your AI, at work."
                    : tab}
              </h1>
              <p>{DESCRIPTIONS[tab]}</p>
            </div>
            <div className="heading-actions">
              {tab === "Overview" && (
                <button
                  className="button secondary"
                  onClick={() =>
                    user ? navigate("Settings") : setAuthOpen(true)
                  }
                >
                  <Plus size={16} />
                  Configure funds
                </button>
              )}
              {tab === "Trade history" && (
                <button
                  disabled={!visibleTrades.length}
                  className="button secondary"
                  onClick={exportTrades}
                >
                  <Download size={16} />
                  Export loaded trades
                </button>
              )}
              {user && (
                <span
                  className={`sync-label ${data.connected ? "synced" : ""}`}
                >
                  <span />
                  {data.connection}
                </span>
              )}
            </div>
          </div>
          {!data.browserOnline && (
            <div className="alert error" role="status">
              You are offline. Displayed data may be stale. No new commands can
              be sent, but your AI session may still be running on the server.
            </div>
          )}
          {authError && (
            <div className="alert error" role="alert">
              <span>Authentication: {authError}</span>
            </div>
          )}
          {error && (
            <div className="alert error" role="alert">
              <span>{error}</span>
              <button
                className="icon-button"
                aria-label="Dismiss error"
                onClick={() => data.setError("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {isEmulator && (
            <div className="emulator-strip">
              <ShieldCheck size={14} />
              LOCAL FIREBASE EMULATORS — isolated test project, not your
              production Firebase account.
            </div>
          )}
          {!user && (
            <div className="welcome-strip">
              <div className="welcome-icon">
                <Sparkles size={21} />
              </div>
              <div>
                <strong>Build confidence before you build a portfolio.</strong>
                <p>
                  Create your account for $10 in welcome virtual funds. Your
                  progress stays with you.
                </p>
              </div>
              <button
                className="button primary"
                onClick={() => setAuthOpen(true)}
              >
                Open simulation account
                <ArrowUpRight size={16} />
              </button>
            </div>
          )}
          {user && !account && (
            <div className="setup-panel">
              <ShieldCheck size={22} />
              <div>
                <strong>Connecting your persistent account</strong>
                <p>
                  If this does not complete, open Settings → System connection,
                  enable Firebase Email/Password authentication, deploy
                  Firestore rules, and configure server Application Default
                  Credentials. No fallback balance will be created in your
                  browser.
                </p>
              </div>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => void command({ action: "initialize" })}
              >
                Retry connection
              </button>
            </div>
          )}
          {tab === "Overview" && (
            <>
              <div className="metrics-grid">
                <section className="metric-card balance-card">
                  <div className="metric-label">
                    Simulated balance
                    <Wallet size={17} />
                  </div>
                  <h2>
                    {money(account?.balanceCents)}
                    <span>USD</span>
                  </h2>
                  <div className="balance-card-bottom">
                    <span>
                      <i />
                      VIRTUAL FUNDS
                    </span>
                    <ShieldCheck size={15} />
                  </div>
                  <div className="balance-decoration" />
                </section>
                <section className="metric-card">
                  <div className="metric-label">
                    Available balance
                    <ArrowUpRight size={17} />
                  </div>
                  <h2>{money(available)}</h2>
                  <p>
                    <span className="subtle-icon">
                      <Wallet size={12} />
                    </span>
                    {money(
                      account
                        ? account.reservedCents + account.withdrawalHoldCents
                        : null,
                    )}{" "}
                    allocated or on hold
                  </p>
                </section>
                <section className="metric-card">
                  <div className="metric-label">
                    Today’s realized P/L
                    <TrendingUp size={17} />
                  </div>
                  <h2 className={today && today < 0 ? "negative" : "positive"}>
                    {money(today, true)}
                  </h2>
                  <p>
                    All-time{" "}
                    <b
                      className={
                        account && account.totalPnlCents < 0
                          ? "negative"
                          : "positive"
                      }
                    >
                      {money(account?.totalPnlCents, true)}
                    </b>
                    <span className="utc-label">UTC</span>
                  </p>
                </section>
                <section className="metric-card">
                  <div className="metric-label">
                    Trading performance
                    <Target size={17} />
                  </div>
                  <h2>
                    {account ? account.trades : "—"}
                    <span>trades</span>
                  </h2>
                  <p>
                    <span className="positive">
                      {account ? account.wins : "—"} won
                    </span>
                    <span className="dot-separator">·</span>
                    <span className="negative">
                      {account ? account.losses : "—"} lost
                    </span>
                    <span className="utc-label">
                      {winRate === null ? "—" : winRate + "%"} win rate
                    </span>
                  </p>
                </section>
              </div>
              <div className="dashboard-primary">
                <section className="panel performance-panel">
                  <PanelHead
                    title="Account performance"
                    subtitle="Simulated balance · includes recorded fund adjustments"
                  />
                  <div className="performance-toolbar">
                    <div>
                      <strong>{money(account?.balanceCents)}</strong>
                      <span className={openPnl < 0 ? "negative" : "positive"}>
                        {money(account ? openPnl : null, true)}
                        <small>unrealized P/L</small>
                      </span>
                    </div>
                    <div className="segmented compact">
                      {["1H", "24H", "ALL"].map((p) => (
                        <button
                          key={p}
                          className={period === p ? "selected" : ""}
                          onClick={() => setPeriod(p)}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Chart
                    points={chartPoints}
                    label="Account balance from recorded ledger transactions"
                    empty={
                      account
                        ? "Your next chapter is a trade away"
                        : "A fresh start. A clear perspective."
                    }
                  />
                  <div className="chart-footer">
                    <span>
                      <i />
                      Simulated balance
                    </span>
                    <span>
                      From your latest 100 ledger entries
                      <ShieldCheck size={12} />
                    </span>
                  </div>
                </section>
                {sessionCard}
              </div>
              <div className="dashboard-secondary">
                <section className="panel market-panel">
                  <PanelHead
                    title="Market watch"
                    subtitle="Synthetic price feed · 5-second observations"
                    action="Explore markets"
                    onAction={() => navigate("Markets")}
                  />
                  {marketTable()}
                  <div className="panel-footnote">
                    <span className={online ? "pulse-dot" : "quiet-dot"} />
                    {feed
                      ? `Last quote ${new Date(feed.updatedAt).toLocaleTimeString()} · ${feed.quotes[0]?.history.length || 0} observations`
                      : "Waiting for your connected market feed"}
                    <span>Not live market prices</span>
                  </div>
                </section>
                <section className="panel activity-panel">
                  <PanelHead
                    title="AI activity"
                    subtitle="Every step, in the open"
                    action="View all"
                    onAction={() => setModal("activity")}
                  />
                  <ActivityList items={activity.slice(0, 5)} />
                  <div className="activity-bottom">
                    <span className={online ? "pulse-dot" : "quiet-dot"} />
                    {current ? current.aiStatus : "Your AI is standing by"}
                    <Activity size={14} />
                  </div>
                </section>
              </div>
              <section className="panel recent-panel">
                <PanelHead
                  title="Recent trades"
                  subtitle="Actual simulated outcomes. Wins and losses included."
                  action="View trade history"
                  onAction={() => navigate("Trade history")}
                />
                {tradeTable(trades.slice(0, 5))}
              </section>
            </>
          )}
          {tab === "AI sessions" && (
            <>
              <div className="session-layout">
                {sessionCard}
                <section className="panel strategy-panel">
                  <PanelHead
                    title="The strategy behind the signal"
                    subtitle="Transparent rules-based analysis, not a predictive guarantee"
                    action="Edit settings"
                    onAction={() => navigate("Settings")}
                  />
                  <div className="strategy-content">
                    <div className="strategy-heading">
                      <span className="strategy-icon">
                        <Zap size={24} />
                      </span>
                      <div>
                        <h2>
                          {(
                            current?.strategy ||
                            account?.settings.strategy ||
                            "MOMENTUM"
                          )
                            .replace("_", " ")
                            .toLowerCase()}
                        </h2>
                        <p>Strategy version rules-v1.0 · synthetic data</p>
                      </div>
                      <Badge tone="green">PAPER ONLY</Badge>
                    </div>
                    <p className="body-copy">
                      The engine compares each price with its recent mean, then
                      follows momentum or looks for a reversion. Signals pass
                      through allocation and exposure limits before a simulated
                      position can open. There is no targeted or fabricated win
                      rate.
                    </p>
                    <div className="strategy-stats">
                      <div>
                        <small>Trade allocation</small>
                        <strong>
                          {money(activeSettings?.tradeAmountCents)}
                        </strong>
                      </div>
                      <div>
                        <small>Stop loss / take profit</small>
                        <strong>
                          {activeSettings
                            ? `${activeSettings.stopLossPct}% / ${activeSettings.takeProfitPct}%`
                            : "—"}
                        </strong>
                      </div>
                      <div>
                        <small>Session loss limit</small>
                        <strong>
                          {activeSettings
                            ? `${activeSettings.maxSessionLossPct}%`
                            : "—"}
                        </strong>
                      </div>
                    </div>
                    <div className="pipeline">
                      {[
                        "Market data",
                        "Strategy",
                        "Risk checks",
                        "Paper execution",
                        "Firestore",
                      ].map((s, i) => (
                        <span key={s}>
                          {i > 0 && <ChevronRight size={13} />}
                          <b>{s}</b>
                        </span>
                      ))}
                    </div>
                    <div className="info-box">
                      <Clock3 size={19} />
                      <p>
                        Sessions run in an independent server worker, not a
                        browser timer. Closing this app doesn’t stop trading. At
                        expiry, new trades stop and open positions close at the
                        next observed quote. Pausing leaves positions under risk
                        management.
                      </p>
                    </div>
                  </div>
                </section>
              </div>
              <section className="panel recent-panel">
                <PanelHead
                  title="Session history"
                  subtitle="Latest 100 sessions · persisted start and end states"
                />
                {sessions.length ? (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Session</th>
                          <th>Started</th>
                          <th>Duration</th>
                          <th>Starting → ending balance</th>
                          <th>Net P/L</th>
                          <th>Trades</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sessions.map((s) => (
                          <tr key={s.id}>
                            <td className="mono">{s.id.slice(0, 8)}</td>
                            <td>{date(s.startedAt)}</td>
                            <td>
                              {s.durationSeconds === null
                                ? "Unlimited"
                                : `${s.durationSeconds / 60} min`}
                            </td>
                            <td>
                              {money(s.startingBalanceCents)} →{" "}
                              {money(s.endingBalanceCents)}
                            </td>
                            <td
                              className={
                                s.totalPnlCents < 0 ? "negative" : "positive"
                              }
                            >
                              {money(s.totalPnlCents, true)}
                            </td>
                            <td>{s.tradesGenerated}</td>
                            <td>
                              <Badge
                                tone={
                                  s.status === "ACTIVE" ? "green" : "neutral"
                                }
                              >
                                {s.status}
                              </Badge>
                              <small>
                                {s.stopReason?.replaceAll("_", " ")}
                              </small>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty
                    title="A clean session history"
                    text="Choose a duration and start your first autonomous trading session."
                    icon={<Bot size={28} />}
                  />
                )}
              </section>
            </>
          )}
          {tab === "Markets" && (
            <>
              <div className="market-tabs">
                {SYMBOLS.map((s, i) => (
                  <button
                    className={selectedMarket === s ? "selected" : ""}
                    onClick={() => setSelectedMarket(s)}
                    key={s}
                  >
                    <span className={`asset-icon asset-${i}`}>
                      {["€", "£", "Au", "₿"][i]}
                    </span>
                    <div>
                      <b>{s}</b>
                      <small>
                        {feed?.quotes.find((q) => q.symbol === s)?.name ||
                          "Synthetic market"}
                      </small>
                    </div>
                    {selectedMarket === s && <Check size={16} />}
                  </button>
                ))}
              </div>
              <section className="panel market-chart">
                <PanelHead
                  title={selectedMarket}
                  subtitle="Synthetic prices · latest 120 observations · not a live market feed"
                />
                <div className="market-price">
                  <strong>
                    {feed?.quotes
                      .find((q) => q.symbol === selectedMarket)
                      ?.price.toLocaleString("en-US", {
                        maximumFractionDigits: 5,
                      }) || "—"}
                  </strong>
                  <Badge tone={online ? "green" : "neutral"}>
                    {online ? "FEED ACTIVE" : "FEED OFFLINE"}
                  </Badge>
                </div>
                <Chart
                  points={
                    feed?.quotes
                      .find((q) => q.symbol === selectedMarket)
                      ?.history.map((p) => ({
                        time: p.time,
                        value: p.price,
                      })) || []
                  }
                  label={`${selectedMarket} synthetic market prices`}
                  empty="Waiting for market observations"
                />
              </section>
              <section className="panel recent-panel">
                <PanelHead
                  title="Market scanner"
                  subtitle="Decisions reflect your configured strategy; trading requires an active session"
                />
                {marketTable()}
              </section>
            </>
          )}
          {tab === "Trade history" && (
            <section className="panel">
              <div className="table-toolbar">
                <div className="search-field">
                  <Search size={16} />
                  <input
                    aria-label="Search trades"
                    placeholder="Search market, side, or trade ID…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <select
                  aria-label="Filter trades"
                  value={tradeFilter}
                  onChange={(e) => setTradeFilter(e.target.value)}
                >
                  {["All trades", "Open positions", "Winning", "Losing"].map(
                    (f) => (
                      <option key={f}>{f}</option>
                    ),
                  )}
                </select>
                <span>{visibleTrades.length} loaded trades</span>
              </div>
              {tradeTable(visibleTrades)}
              {data.hasMore && (
                <button
                  disabled={busy}
                  className="button secondary load-more"
                  onClick={() => void data.moreTrades()}
                >
                  Load older trades
                </button>
              )}
              <div className="panel-footnote">
                Net P/L includes round-trip simulation fees. Open positions show
                unrealized P/L.
              </div>
            </section>
          )}
          {tab === "Withdrawals" &&
            (account ? (
              <WithdrawalView
                account={account}
                withdrawals={withdrawals}
                ledger={ledger}
                command={command}
                busy={busy}
              />
            ) : (
              <AccountRequired signIn={() => setAuthOpen(true)} user={!!user} />
            ))}
          {tab === "Settings" && (
            <SystemStatus
              health={health}
              connection={data.connection}
              browserOnline={data.browserOnline}
            />
          )}
          {tab === "Settings" &&
            (account ? (
              <>
                <SettingsView
                  key={account.uid}
                  account={account}
                  command={command}
                  busy={busy}
                />
                <div className="signout-panel">
                  <div>
                    <strong>Signed in as {user?.email}</strong>
                    <p>
                      Signing out does not stop an active AI session. Use STOP
                      AI TRADING first if needed.
                    </p>
                  </div>
                  <button
                    className="button secondary"
                    onClick={() =>
                      void signOutUser().catch((e) => data.setError(e.message))
                    }
                  >
                    <LogOut size={16} />
                    Sign out
                  </button>
                </div>
              </>
            ) : (
              <AccountRequired signIn={() => setAuthOpen(true)} user={!!user} />
            ))}
          {tab === "Settings" && user && !account && (
            <div className="signout-panel">
              <p className="helper">
                Signed in to Firebase Auth as {user.email}. Account
                initialization is pending.
              </p>
              <button
                className="button secondary"
                onClick={() =>
                  void signOutUser().catch((error) =>
                    data.setError(error.message),
                  )
                }
              >
                <LogOut size={16} />
                Sign out
              </button>
            </div>
          )}
          {tab === "Admin" && user && admin && <AdminView user={user} />}
          <footer className="footer">
            <span>
              <ShieldCheck size={13} />
              Simulation only. No real funds. No live orders.
            </span>
            <span>
              NEXUS AI <i /> Rules-based analysis, not financial advice.
              <button onClick={() => setModal("help")}>
                Learn more
                <ArrowUpRight size={12} />
              </button>
            </span>
          </footer>
        </main>
      </div>
      {authOpen && <AuthDialog onClose={() => setAuthOpen(false)} />}{" "}
      {data.notice && (
        <div className="toast" role="status">
          <span>
            <Check size={16} />
          </span>
          {data.notice}
          <button
            className="icon-button"
            onClick={() => data.setNotice("")}
            aria-label="Dismiss notification"
          >
            <X size={16} />
          </button>
        </div>
      )}
      {modal === "activity" && (
        <Modal title="AI activity timeline" onClose={() => setModal(null)}>
          <p className="body-copy">
            Latest 100 timestamped events, saved in your private Firestore
            account.
          </p>
          <div className="modal-scroll">
            <ActivityList items={activity} />
          </div>
        </Modal>
      )}
      {modal === "help" && (
        <Modal
          title="Practice with an intelligent edge."
          onClose={() => setModal(null)}
        >
          <div className="help-content">
            <div className="info-box">
              <ShieldCheck size={24} />
              <p>
                This is a simulation. Virtual balances cannot be redeemed for
                cash, and no real broker orders or payments are sent.
              </p>
            </div>
            {[
              [
                "01",
                "Create your account",
                "Firebase Authentication protects your sign-in. A one-time $10 welcome credit is recorded in your private account ledger.",
              ],
              [
                "02",
                "Make it your own",
                "Configure virtual funds and risk controls in Settings. Start a timed or unlimited AI session.",
              ],
              [
                "03",
                "Let the strategy work",
                "An independent worker samples synthetic prices every five seconds, analyzes rules-based signals, applies risk checks, and manages positions. Both profitable and losing outcomes are possible.",
              ],
              [
                "04",
                "Stay in control",
                "Pause new entries, resume before the original deadline, or stop and settle positions. Reopening the app restores your Firestore state, not a new balance.",
              ],
            ].map(([n, t, d]) => (
              <div className="help-step" key={n}>
                <span>{n}</span>
                <div>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </div>
              </div>
            ))}
            <p className="helper">
              Synthetic data is not real market data. No language model or
              claimed predictive accuracy is used. A future licensed feed or
              authorized broker adapter must be deployed separately; live
              execution is not implemented here.
            </p>
          </div>
        </Modal>
      )}
      {trade && (
        <Modal
          title={`Trade detail · ${trade.market}`}
          onClose={() => setTrade(null)}
        >
          <div className="trade-detail-top">
            <Badge tone={trade.side === "BUY" ? "green" : "red"}>
              {trade.side}
            </Badge>
            <strong className={trade.pnlCents < 0 ? "negative" : "positive"}>
              {money(trade.pnlCents, true)}
            </strong>
          </div>
          <dl className="detail-grid">
            {[
              ["Trade ID", trade.id],
              ["Session ID", trade.sessionId],
              ["Entry price", trade.entryPrice],
              ["Exit / current price", trade.exitPrice ?? trade.currentPrice],
              ["Allocation", money(trade.amountCents)],
              ["Quantity", trade.quantity.toPrecision(8)],
              ["Fees", money(trade.feesCents)],
              ["Stop loss", trade.stopLoss.toPrecision(8)],
              ["Take profit", trade.takeProfit.toPrecision(8)],
              ["Opened", date(trade.startedAt)],
              ["Closed", date(trade.endedAt)],
              ["Result", trade.result || "OPEN"],
              ["Close reason", trade.closeReason || "Still monitoring"],
              ["Strategy version", trade.strategyVersion],
              ["AI decision", trade.aiDecision],
              ["Feed", trade.source],
            ].map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <div className="info-box">
            <BookOpen size={20} />
            <p>{trade.reason}</p>
          </div>
          <p className="helper">
            Net P/L = allocation × signed price return − round-trip fees (2
            bps), rounded to cents. Loss is capped at allocated collateral. No
            leverage; no real execution.
          </p>
        </Modal>
      )}
    </div>
  );
}
function ActivityList({ items }: { items: ActivityItem[] }) {
  return items.length ? (
    <div className="activity-list">
      {items.map((a) => (
        <div
          key={a.id}
          className={`activity-item ${a.kind === "TRADE CLOSED" ? "closed" : ""}`}
        >
          <span className="activity-dot">
            {a.kind === "TRADE CLOSED" ? (
              <Check size={10} />
            ) : a.kind === "TRADE OPEN" ? (
              <ArrowUpRight size={10} />
            ) : null}
          </span>
          <div>
            <div className="activity-title">
              <strong>{a.kind.replaceAll("_", " ")}</strong>
              <time>
                {new Date(a.timestamp).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </time>
            </div>
            <p>{a.message}</p>
          </div>
        </div>
      ))}
    </div>
  ) : (
    <div className="activity-empty">
      <span className="radar">
        <Bot size={28} />
        <i />
        <i />
      </span>
      <strong>Quiet for now. Ready for what’s next.</strong>
      <p>
        Start a session and follow every scan,
        <br />
        signal, and simulated trade in real time.
      </p>
      <span className="standby-label">
        <i />
        STANDING BY
      </span>
    </div>
  );
}
function AccountRequired({
  signIn,
  user,
}: {
  signIn: () => void;
  user: boolean;
}) {
  return (
    <section className="panel account-required">
      <ShieldCheck size={34} />
      <h2>
        {user
          ? "Your account is connecting"
          : "Your workspace starts with you."}
      </h2>
      <p>
        {user
          ? "Check the connection details above. Your account must be stored in Firebase before you can continue."
          : "Create an account to save your balance, preferences, and every step of your trading journey."}
      </p>
      {!user && (
        <button className="button primary" onClick={signIn}>
          Create or sign in to your account
          <ArrowRight size={16} />
        </button>
      )}
    </section>
  );
}
