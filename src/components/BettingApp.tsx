"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import sfx from "@/lib/sound";
import { currency, toNumber } from "@/lib/money";
import type { Bet, Wallet } from "@/lib/wallet";
import { cashOutBet, depositWallet, loadWallet, resetWallet, requestWithdrawal, saveWallet } from "@/lib/wallet";
import CasinoTab from "./GameBoards";
import Sportsbook from "./Sportsbook";
import { fetchSports, getApiKey, setApiKey } from "@/lib/odds";

type Tab = "sports" | "casino" | "bets";

type Banner = { title: string; sub: string; tone: "win" | "cash" | "info" } | null;

type ConfettiPiece = { id: number; left: number; delay: number; color: string; size: number; tilt: number; dur: number; drift: number };

const CONFETTI_COLORS = ["#22d3ee", "#34d399", "#fbbf24", "#f472b6", "#a78bfa", "#f87171", "#fde68a", "#ffffff"];

export default function BettingApp() {
  const [tab, setTab] = useState<Tab>("sports");
  const [wallet, setWallet] = useState<Wallet>(() => loadWallet());
  const [muted, setMuted] = useState(sfx.isMuted());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);
  const [shaking, setShaking] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [keyDraft, setKeyDraft] = useState(getApiKey());
  const [keyVisible, setKeyVisible] = useState(false);
  const [keyTest, setKeyTest] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState("100");
  const [withdrawAmount, setWithdrawAmount] = useState("50");
  const [depositBusy, setDepositBusy] = useState(false);
  const checkedSession = useRef(false);

  /* ---------------- persistence & session restore ---------------- */

  useEffect(() => {
    saveWallet(wallet);
  }, [wallet]);

  useEffect(() => {
    const unlock = () => sfx.unlock();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  // Restore a completed Stripe Checkout session (?deposit_session=...).
  useEffect(() => {
    if (checkedSession.current || typeof window === "undefined") return;
    checkedSession.current = true;
    const sp = new URLSearchParams(window.location.search);
    const session = sp.get("deposit_session");
    const cancelled = sp.get("deposit");
    if (cancelled === "cancelled") {
      window.setTimeout(() => setToast("Deposit cancelled — no charge was made."), 0);
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }
    if (!session) return;
    fetch(`/api/checkout/confirm?session_id=${encodeURIComponent(session)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.paid && data.amount > 0) {
          const w = depositWallet(loadWallet(), data.amount, "Stripe", "Checkout session paid");
          saveWallet(w);
          setWallet(w);
          sfx.deposit();
          setToast(`${currency.format(data.amount)} added to your balance.`);
        } else if (data?.paid) {
          setToast("Payment confirmed.");
        } else {
          setToast("Payment could not be confirmed.");
        }
        window.history.replaceState({}, "", window.location.pathname);
      })
      .catch(() => {
        setToast("Could not verify the payment right now.");
        window.history.replaceState({}, "", window.location.pathname);
      });
  }, []);

  /* ---------------- effects & celebration ---------------- */

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((current) => (current === message ? null : current)), 2800);
  }, []);

  const spawnConfetti = useCallback(() => {
    setConfetti(
      Array.from({ length: 110 }, (_, i) => ({
        id: i + Date.now(),
        left: Math.random() * 100,
        delay: Math.random() * 0.45,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: 6 + Math.random() * 8,
        tilt: Math.random() * 360,
        dur: 2.4 + Math.random() * 1.5,
        drift: Math.random() * 140 - 70,
      }))
    );
    window.setTimeout(() => setConfetti([]), 4600);
  }, []);

  const celebrate = useCallback(
    (bet: Bet) => {
      if (bet.status === "won") {
        const profit = bet.payout - bet.stake;
        if (profit >= 100) sfx.bigWin();
        else sfx.win();
        spawnConfetti();
        setBanner({ title: "YOU WON", sub: `+${currency.format(profit)} · ${bet.game} — ${bet.label}`, tone: "win" });
      } else if (bet.status === "lost") {
        sfx.loss();
        setShaking(true);
        window.setTimeout(() => setShaking(false), 650);
      } else if (bet.status === "cashed") {
        sfx.cashout();
        const profit = bet.payout - bet.stake;
        setBanner({
          title: profit >= 0 ? "CASHED OUT" : "BET SETTLED",
          sub: `${currency.format(bet.payout)} returned${profit >= 0 ? ` (+${currency.format(profit)})` : ""} · ${bet.label}`,
          tone: "cash",
        });
        if (profit >= 50) spawnConfetti();
      }
    },
    [spawnConfetti]
  );

  useEffect(() => {
    if (!banner) return;
    const t = window.setTimeout(() => setBanner(null), 3400);
    return () => window.clearTimeout(t);
  }, [banner]);

  /* ---------------- actions ---------------- */

  function openTab(next: Tab) {
    sfx.click();
    setTab(next);
  }

  function placeDeposit() {
    const amount = Math.max(5, toNumber(depositAmount));
    if (!amount) return;
    setDepositBusy(true);
    fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.error) {
          sfx.error();
          showToast(data.error);
          return;
        }
        if (data?.sandbox) {
          const w = depositWallet(loadWallet(), amount, "Sandbox deposit", data.note);
          saveWallet(w);
          setWallet(w);
          sfx.deposit();
          showToast(`${currency.format(amount)} added (sandbox — set STRIPE_SECRET_KEY for real cards).`);
          setDepositOpen(false);
        } else if (data?.url) {
          window.location.href = data.url;
        }
      })
      .catch(() => {
        sfx.error();
        showToast("Deposit service unreachable.");
      })
      .finally(() => setDepositBusy(false));
  }

  function doWithdraw() {
    const amount = toNumber(withdrawAmount);
    const next = requestWithdrawal(wallet, amount);
    if (!next) {
      sfx.error();
      showToast("Enter an amount you can actually withdraw.");
      return;
    }
    setWallet(next);
    sfx.chip();
    showToast("Withdrawal request logged — payouts require a licensed payment processor.");
    setWithdrawOpen(false);
  }

  function saveKey() {
    setApiKey(keyDraft);
    sfx.chip();
    setKeyTest(null);
    if (keyDraft.trim()) {
      fetchSports()
        .then((res) => {
          if (!res.demo) {
            setKeyTest(`✓ Key accepted — ${res.data.length} sports loaded${res.remaining ? ` · ${res.remaining} requests left` : ""}.`);
            sfx.win();
          } else if (res.error === "invalid-key") {
            setKeyTest("✕ Key rejected by The Odds API (401). Check it at the-odds-api.com.");
            sfx.error();
          } else {
            setKeyTest("Key saved. Odds service unreachable from this host — real odds will load where the network allows.");
            sfx.chip();
          }
        })
        .catch(() => {
          setKeyTest("Could not test the connection right now.");
        });
    } else {
      showToast("API key cleared — demo odds active.");
    }
  }

  function resetDemo() {
    sfx.chip();
    setWallet(resetWallet());
    showToast("Demo balance restored to the $250 welcome bonus.");
  }

  /* ---------------- derived ---------------- */

  const openCount = wallet.bets.filter((b) => b.status === "open").length;
  const totalWagered = wallet.bets.reduce((sum, b) => sum + b.stake, 0);
  const totalReturned = wallet.bets.reduce((sum, b) => sum + b.payout, 0);

  const feedItems = useMemo(() => {
    const real = wallet.bets
      .filter((b) => b.status !== "open")
      .slice(0, 10)
      .map((b) => ({
        id: b.id,
        icon: b.status === "won" ? "🟢" : b.status === "cashed" ? "🔵" : "🔴",
        text: `${b.game} · ${b.label}`,
        amount: b.payout - b.stake,
      }));
    const seeded: { id: string; icon: string; text: string; amount: number }[] = [
      { id: "s1", icon: "🟢", text: "NBA · Lakers ML", amount: 46.2 },
      { id: "s2", icon: "🔴", text: "EPL · Over 2.5 goals", amount: -25 },
      { id: "s3", icon: "🟢", text: "Zambia Super League · Zesco United", amount: 63.75 },
      { id: "s4", icon: "🟢", text: "Sky Crash · 2.4×", amount: 42 },
    ];
    return [...real, ...seeded].slice(0, 12);
  }, [wallet.bets]);

  /* ---------------- render ---------------- */

  return (
    <main className={`min-h-screen overflow-x-hidden bg-[#070b16] text-slate-100 ${shaking ? "app-shake" : ""}`}>
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(46,211,183,.14),transparent_27%),radial-gradient(circle_at_85%_9%,rgba(105,88,255,.16),transparent_24%),linear-gradient(180deg,#0c1325_0%,#070b16_44%,#070b16_100%)]" />

      {/* Live ticker */}
      <div className="ticker relative z-30 border-b border-white/[0.06] bg-[#0a0f1e]/90 backdrop-blur">
        <div className="flex items-center">
          <span className="z-10 flex shrink-0 items-center gap-1.5 border-r border-white/[0.08] bg-[#0a0f1e] px-3 py-1.5 text-[9px] font-black tracking-[0.2em] text-white">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" /> LIVE WINS
          </span>
          <div className="ticker-mask relative flex-1 overflow-hidden">
            <div className="ticker-track flex w-max items-center gap-8 whitespace-nowrap py-1.5">
              {[...feedItems, ...feedItems].map((item, index) => (
                <span key={`${item.id}-${index}`} className="text-[10px] font-semibold text-slate-400">
                  <span className="mr-1">{item.icon}</span>
                  <span className="text-slate-300">{item.text}</span>{" "}
                  <b className={item.amount >= 0 ? "text-emerald-300" : "text-rose-300"}>
                    {item.amount >= 0 ? "+" : ""}{currency.format(item.amount)}
                  </b>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#0b1120]/85 shadow-2xl shadow-black/30 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1540px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6 lg:px-8">
          <button onClick={() => openTab("sports")} className="flex items-center gap-3 text-left">
            <div className="logo-badge grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-amber-300 via-orange-400 to-rose-500 text-lg font-black text-slate-950 shadow-lg shadow-orange-500/25">X</div>
            <div>
              <p className="text-sm font-black leading-none tracking-[0.14em] text-white">XACHEUS <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-rose-300">BETTING</span></p>
              <p className="mt-1 text-[9px] font-bold tracking-[0.22em] text-cyan-300">REAL ODDS · INSTANT PAYOUTS</p>
            </div>
          </button>

          <nav className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto px-1 sm:order-none sm:w-auto">
            {([
              ["sports", "🏟 Sportsbook"],
              ["casino", "🎰 Casino"],
              ["bets", "🧾 My Bets"],
            ] as [Tab, string][]).map(([id, label]) => (
              <button
                key={id}
                onClick={() => openTab(id)}
                className={`relative rounded-xl px-4 py-2 text-xs font-black tracking-wide transition ${tab === id ? "tab-active text-white" : "text-slate-400 hover:text-white"}`}
              >
                {label}
                {id === "bets" && openCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-rose-500 px-1.5 py-0.5 text-[9px] font-black text-white">{openCount}</span>
                )}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={() => { const next = sfx.toggleMuted(); setMuted(next); sfx.click(); }}
              title={muted ? "Unmute sounds" : "Mute sounds"}
              className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.045] text-sm transition hover:bg-white/10"
            >
              {muted ? "🔇" : "🔊"}
            </button>
            <button
              onClick={() => { sfx.click(); setSettingsOpen(true); }}
              title="Settings & API key"
              className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.045] text-sm transition hover:bg-white/10"
            >
              ⚙️
            </button>
            <div className="balance-pill flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.08] px-3 py-1.5">
              <span className="text-xs">◈</span>
              <div>
                <p className="text-[8px] font-bold leading-none tracking-[0.14em] text-emerald-200/60">BALANCE</p>
                <AnimatedMoney value={wallet.balance} />
              </div>
            </div>
            <button onClick={() => { sfx.click(); setDepositOpen(true); }} className="rounded-xl bg-gradient-to-r from-amber-300 to-rose-400 px-4 py-2 text-xs font-black text-slate-950 shadow-lg shadow-rose-500/20 transition hover:brightness-110 active:scale-[0.98]">
              + DEPOSIT
            </button>
          </div>
        </div>
      </header>

      <div className="relative mx-auto max-w-[1540px] px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        {/* Hero strip */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[11px] font-bold tracking-[0.14em] text-cyan-300">
              <span className="h-px w-7 bg-cyan-300" /> {tab === "sports" ? "LIVE SPORTSBOOK & REAL ODDS" : tab === "casino" ? "INSTANT CASINO GAMES" : "YOUR BETTING LEDGER"}
            </div>
            <h1 className="text-3xl font-black tracking-[-0.04em] text-white sm:text-4xl">
              {tab === "sports" && <>Bet the <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 via-emerald-200 to-lime-200">real odds</span>.</>}
              {tab === "casino" && <>Win big. <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-rose-200 to-pink-200">Feel the rush.</span></>}
              {tab === "bets" && <>Every bet, <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-200 to-cyan-200">every result.</span></>}
            </h1>
          </div>
          <p className="max-w-md text-xs leading-5 text-slate-500">
            {tab === "sports" && "Powered by The Odds API — real bookmaker odds on the markets you love. Settle automatically when games finish."}
            {tab === "casino" && "Provably random instant games with animated rounds, payout sounds and a shared balance."}
            {tab === "bets" && "Track open bets, cash out early, and review every deposit, win and loss."}
          </p>
        </div>

        {tab === "sports" && <Sportsbook wallet={wallet} setWallet={setWallet} onResult={celebrate} />}
        {tab === "casino" && <CasinoTab wallet={wallet} setWallet={setWallet} onResult={celebrate} />}
        {tab === "bets" && (
          <BetsLedger
            wallet={wallet}
            totalWagered={totalWagered}
            totalReturned={totalReturned}
            onReset={resetDemo}
            onCashOut={(bet) => {
              const next = cashOutBet(wallet, bet.id, bet.odds);
              if (next) {
                setWallet(next);
                const cashed = next.bets.find((b) => b.id === bet.id);
                if (cashed) celebrate(cashed);
              }
            }}
          />
        )}

        <footer className="mt-12 flex flex-col items-center justify-between gap-2 border-t border-white/[0.06] pt-6 text-center text-[10px] font-semibold tracking-[0.08em] text-slate-600 sm:flex-row sm:text-left">
          <span>© 2026 XACHEUS BETTING</span>
          <span>18+ · PLAY RESPONSIBLY · GAMBLING CAN BE ADDICTIVE</span>
          <span>DEMO PLATFORM · REAL PAYOUTS REQUIRE A LICENSED PROCESSOR</span>
        </footer>
      </div>

      {/* Win banner */}
      {banner && (
        <div key={banner.title + banner.sub} className={`win-banner fixed left-1/2 top-20 z-[60] ${banner.tone === "win" ? "win-banner-win" : "win-banner-cash"}`}>
          <p className="text-[10px] font-black tracking-[0.25em] text-white/80">{banner.title}</p>
          <p className="mt-1 text-xl font-black text-white sm:text-2xl">{banner.sub}</p>
        </div>
      )}

      {/* Confetti */}
      {confetti.length > 0 && (
        <div className="pointer-events-none fixed inset-0 z-[55] overflow-hidden">
          {confetti.map((piece) => (
            <span
              key={piece.id}
              className="confetti-piece"
              style={{
                left: `${piece.left}%`,
                width: piece.size,
                height: piece.size * 0.42,
                background: piece.color,
                animationDuration: `${piece.dur}s`,
                animationDelay: `${piece.delay}s`,
                ["--drift" as string]: `${piece.drift}px`,
                ["--tilt" as string]: `${piece.tilt}deg`,
              }}
            />
          ))}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="toast-pop fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-xl border border-white/10 bg-[#131b30]/95 px-4 py-2.5 text-xs font-semibold text-slate-100 shadow-2xl shadow-black/40 backdrop-blur">
          {toast}
        </div>
      )}

      {/* Modals */}
      {settingsOpen && (
        <Modal title="Settings & API key" onClose={() => setSettingsOpen(false)}>
          <div className="space-y-4">
            <div className="rounded-xl border border-cyan-300/15 bg-cyan-300/[0.05] p-3 text-[11px] leading-5 text-slate-300">
              <b className="text-cyan-200">The Odds API key</b> unlocks real bookmaker odds on the Sportsbook. The key is sent to our server proxy and never included in your site bundle. For production, set <code className="rounded bg-black/40 px-1 text-amber-200">ODDS_API_KEY</code> in your environment instead.
            </div>
            <div>
              <label htmlFor="api-key" className="mb-1.5 block text-[10px] font-black tracking-[0.14em] text-slate-500">THE ODDS API KEY</label>
              <div className="flex rounded-xl border border-white/[0.1] bg-[#070b16] p-1 focus-within:border-cyan-300/50">
                <input
                  id="api-key"
                  type={keyVisible ? "text" : "password"}
                  value={keyDraft}
                  onChange={(e) => setKeyDraft(e.target.value)}
                  placeholder="e.g. 4f2a9c1d…"
                  autoComplete="off"
                  className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm font-semibold text-white outline-none"
                />
                <button onClick={() => setKeyVisible((v) => !v)} className="rounded-lg bg-white/[0.07] px-2.5 text-[10px] font-bold text-slate-300 hover:bg-white/[0.12]">{keyVisible ? "HIDE" : "SHOW"}</button>
              </div>
            </div>
            {keyTest && <p className="text-[11px] font-semibold leading-5 text-slate-300">{keyTest}</p>}
            <div className="flex gap-2">
              <button onClick={saveKey} className="flex-1 rounded-xl bg-gradient-to-r from-cyan-300 to-emerald-300 px-4 py-2.5 text-xs font-black text-slate-950 transition hover:brightness-110">SAVE & TEST KEY</button>
              <button onClick={() => { setKeyDraft(""); setApiKey(""); setKeyTest(null); showToast("API key cleared — demo odds active."); }} className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-xs font-bold text-slate-300 transition hover:bg-white/10">CLEAR</button>
            </div>
            <p className="text-[10px] leading-4 text-slate-600">
              Get a free key at <a href="https://the-odds-api.com" target="_blank" rel="noreferrer" className="text-cyan-300 underline">the-odds-api.com</a> (500 requests/month on the free tier). Missing/invalid keys fall back to clearly-labeled demo odds.
            </p>
          </div>
        </Modal>
      )}

      {depositOpen && (
        <Modal title="Deposit funds" onClose={() => setDepositOpen(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-5 gap-2">
              {[25, 50, 100, 250, 500].map((value) => (
                <button
                  key={value}
                  onClick={() => { setDepositAmount(String(value)); sfx.click(); }}
                  className={`rounded-xl border py-2.5 text-xs font-black transition ${toNumber(depositAmount) === value ? "border-amber-300/60 bg-amber-300/15 text-amber-100" : "border-white/[0.08] bg-white/[0.04] text-slate-400 hover:text-white"}`}
                >
                  ${value}
                </button>
              ))}
            </div>
            <div className="flex rounded-xl border border-white/[0.1] bg-[#070b16] p-1 focus-within:border-amber-300/50">
              <span className="grid w-9 place-items-center text-sm font-bold text-slate-500">$</span>
              <input
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                inputMode="decimal"
                className="min-w-0 flex-1 bg-transparent py-2 text-base font-bold text-white outline-none"
              />
            </div>
            <button onClick={placeDeposit} disabled={depositBusy} className="w-full rounded-xl bg-gradient-to-r from-amber-300 to-rose-400 px-4 py-3 text-sm font-black text-slate-950 shadow-lg shadow-rose-500/20 transition hover:brightness-110 disabled:opacity-60">
              {depositBusy ? "CONTACTING PAYMENTS…" : `DEPOSIT ${currency.format(Math.max(5, toNumber(depositAmount)))}`}
            </button>
            <p className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-[10px] leading-4 text-slate-500">
              {depositBusy ? "" : "Card payments go through Stripe Checkout when STRIPE_SECRET_KEY is set. Without it, deposits are sandboxed (instant credit, no real charge). Minimum deposit $5."}
            </p>
            <button onClick={() => { setDepositOpen(false); setWithdrawOpen(true); sfx.click(); }} className="w-full text-center text-[11px] font-bold text-slate-500 underline-offset-2 transition hover:text-white hover:underline">
              Want to withdraw instead?
            </button>
          </div>
        </Modal>
      )}

      {withdrawOpen && (
        <Modal title="Withdraw" onClose={() => setWithdrawOpen(false)}>
          <div className="space-y-4">
            <p className="text-[11px] leading-5 text-slate-400">
              Your available balance is <b className="text-white">{currency.format(wallet.balance)}</b>. Withdrawals are logged as requests — actual payouts require a licensed payment processor.
            </p>
            <div className="flex rounded-xl border border-white/[0.1] bg-[#070b16] p-1 focus-within:border-emerald-300/50">
              <span className="grid w-9 place-items-center text-sm font-bold text-slate-500">$</span>
              <input value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} inputMode="decimal" className="min-w-0 flex-1 bg-transparent py-2 text-base font-bold text-white outline-none" />
            </div>
            <button onClick={doWithdraw} className="w-full rounded-xl bg-gradient-to-r from-emerald-300 to-cyan-300 px-4 py-3 text-sm font-black text-slate-950 transition hover:brightness-110">
              REQUEST WITHDRAWAL
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="modal-pop w-full max-w-md rounded-3xl border border-white/[0.1] bg-[#0e1526] p-6 shadow-2xl shadow-black/60" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-black tracking-tight text-white">{title}</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg bg-white/[0.06] text-xs font-bold text-slate-400 transition hover:bg-white/10 hover:text-white">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function useAnimatedNumber(target: number, duration = 550) {
  const [display, setDisplay] = useState(target);
  const prevRef = useRef(target);
  useEffect(() => {
    const from = prevRef.current;
    prevRef.current = target;
    if (from === target) return;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (target - from) * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return display;
}

function AnimatedMoney({ value }: { value: number }) {
  const display = useAnimatedNumber(value);
  return (
    <p key={Math.round(value)} className="balance-pop text-sm font-black leading-tight text-white">
      {currency.format(display)}
    </p>
  );
}

function BetsLedger({
  wallet,
  totalWagered,
  totalReturned,
  onReset,
  onCashOut,
}: {
  wallet: Wallet;
  totalWagered: number;
  totalReturned: number;
  onReset: () => void;
  onCashOut: (bet: Bet) => void;
}) {
  const net = totalReturned - totalWagered;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["BALANCE", currency.format(wallet.balance), "text-white"],
          ["TOTAL WAGERED", currency.format(totalWagered), "text-slate-200"],
          ["TOTAL RETURNED", currency.format(totalReturned), "text-emerald-300"],
          ["NET RESULT", `${net >= 0 ? "+" : ""}${currency.format(net)}`, net >= 0 ? "text-emerald-300" : "text-rose-300"],
        ].map(([label, value, tone]) => (
          <div key={label} className="rounded-2xl border border-white/[0.07] bg-[#0d1425]/70 p-4">
            <p className="text-[9px] font-black tracking-[0.15em] text-slate-500">{label}</p>
            <p className={`mt-1 text-lg font-black ${tone}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-white/[0.08] bg-[#0d1425]/70 p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-bold text-white">Bet ledger</h2>
            <p className="mt-0.5 text-xs text-slate-500">{wallet.bets.length} bets recorded · {wallet.bets.filter((b) => b.status === "open").length} open</p>
          </div>
          <button onClick={onReset} className="rounded-lg border border-white/10 bg-white/[0.045] px-3 py-1.5 text-[11px] font-bold text-slate-300 transition hover:bg-white/10">Reset demo funds</button>
        </div>

        {wallet.bets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">
            No bets yet — head to the Sportsbook or Casino and place your first one. 🎲
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="text-[9px] font-black tracking-[0.14em] text-slate-500">
                <tr className="border-b border-white/[0.07]">
                  <th className="pb-3">STATUS</th>
                  <th className="pb-3">BET</th>
                  <th className="pb-3 text-right">ODDS</th>
                  <th className="pb-3 text-right">STAKE</th>
                  <th className="pb-3 text-right">RETURN</th>
                  <th className="pb-3 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody>
                {wallet.bets.map((bet) => (
                  <tr key={bet.id} className="border-b border-white/[0.05] last:border-0">
                    <td className="py-3.5">
                      <span className={`status-chip ${bet.status}`}>{bet.status.toUpperCase()}</span>
                    </td>
                    <td className="py-3.5">
                      <p className="font-semibold text-slate-200">{bet.game}</p>
                      <p className="max-w-[260px] truncate text-[10px] text-slate-500">{bet.label}</p>
                    </td>
                    <td className="py-3.5 text-right font-bold text-slate-300">{bet.odds.toFixed(2)}</td>
                    <td className="py-3.5 text-right text-slate-400">{currency.format(bet.stake)}</td>
                    <td className={`py-3.5 text-right font-bold ${bet.payout > bet.stake ? "text-emerald-300" : bet.payout > 0 ? "text-slate-300" : "text-rose-300"}`}>
                      {bet.status === "open" ? "—" : currency.format(bet.payout)}
                    </td>
                    <td className="py-3.5 text-right">
                      {bet.status === "open" && bet.kind === "sports" ? (
                        <button onClick={() => onCashOut(bet)} className="rounded-lg bg-emerald-400/10 px-2.5 py-1 text-[10px] font-black text-emerald-300 transition hover:bg-emerald-400/25">
                          CASH OUT {currency.format(Math.max(bet.stake, Math.round(bet.stake * bet.odds * 0.8 * 100) / 100))}
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {wallet.moves.length > 0 && (
        <div className="rounded-3xl border border-white/[0.08] bg-[#0d1425]/70 p-5 sm:p-6">
          <h2 className="font-bold text-white">Money moves</h2>
          <p className="mb-4 mt-0.5 text-xs text-slate-500">Deposits and withdrawal requests.</p>
          <div className="space-y-2">
            {wallet.moves.slice(0, 10).map((move) => (
              <div key={move.id} className="flex items-center justify-between rounded-xl bg-white/[0.03] px-4 py-2.5 text-xs">
                <div>
                  <p className="font-bold text-slate-200">{move.method}</p>
                  {move.note && <p className="text-[10px] text-slate-500">{move.note}</p>}
                </div>
                <div className="text-right">
                  <p className={`font-black ${move.amount >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{move.amount >= 0 ? "+" : ""}{currency.format(move.amount)}</p>
                  <p className="text-[9px] text-slate-600">{new Date(move.time).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
