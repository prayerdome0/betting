"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import sfx from "@/lib/sound";
import { currency, toNumber } from "@/lib/money";
import type { Bet, Wallet } from "@/lib/wallet";
import { cashOutBet, openBet, openSportsBets, refundBet, settleBet } from "@/lib/wallet";
import type { OddsEvent, OddsOutcome, OddsSport, ScoreEvent } from "@/lib/odds";
import { bestPoint, bestPrice, fetchOdds, fetchScores, fetchSports, formatCommence, marketOutcomes } from "@/lib/odds";

type Selected = {
  eventId: string;
  marketKey: string;
  outcomeName: string;
  price: number;
};

type SportsbookProps = {
  wallet: Wallet;
  setWallet: (wallet: Wallet) => void;
  onResult: (bet: Bet) => void;
};

export default function Sportsbook({ wallet, setWallet, onResult }: SportsbookProps) {
  const [sports, setSports] = useState<OddsSport[]>([]);
  const [sportKey, setSportKey] = useState("upcoming");
  const [events, setEvents] = useState<OddsEvent[]>([]);
  const [loadingSports, setLoadingSports] = useState(true);
  const [loadingOdds, setLoadingOdds] = useState(true);
  const [demo, setDemo] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<string | null>(null);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [stake, setStake] = useState("25");
  const [settling, setSettling] = useState(false);
  const [settleMsg, setSettleMsg] = useState<string | null>(null);
  const latestWallet = useRef(wallet);
  latestWallet.current = wallet;
  const autoSettled = useRef(false);

  const betAmount = Math.max(0, toNumber(stake));

  // Load the sports list once.
  useEffect(() => {
    let alive = true;
    fetchSports().then((res) => {
      if (!alive) return;
      setSports(res.data);
      setDemo(res.demo);
      setDemoError(res.error ?? null);
      setRemaining(res.remaining ?? null);
      setLoadingSports(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Load odds whenever the selected sport changes.
  useEffect(() => {
    let alive = true;
    fetchOdds(sportKey).then((res) => {
      if (!alive) return;
      const now = Date.now();
      setEvents(
        res.data.map((e) => ({
          ...e,
          xacheusLive: !e.completed && new Date(e.commence_time).getTime() < now,
        }))
      );
      setDemo(res.demo);
      setDemoError(res.error ?? null);
      setRemaining(res.remaining ?? null);
      setLoadingOdds(false);
    });
    return () => {
      alive = false;
    };
  }, [sportKey]);

  // Auto-settle open sports bets once on mount if any exist.
  useEffect(() => {
    if (autoSettled.current) return;
    autoSettled.current = true;
    if (openSportsBets(latestWallet.current).length > 0) {
      void settleResults();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedEvent = useMemo(
    () => (selected ? events.find((e) => e.id === selected.eventId) : undefined),
    [selected, events]
  );

  const openBets = useMemo(() => openSportsBets(wallet), [wallet]);

  function cashoutPrice(bet: Bet): number {
    const ev = events.find((e) => e.id === bet.eventId);
    if (!ev || !bet.market || !bet.outcome) return bet.odds;
    const price = bestPrice(ev, bet.market, bet.outcome);
    return price > 0 ? price : bet.odds;
  }

  function selectOutcome(event: OddsEvent, marketKey: string, outcome: OddsOutcome) {
    sfx.click();
    setSelected({ eventId: event.id, marketKey, outcomeName: outcome.name, price: outcome.price });
  }

  function placeBet() {
    if (!selected || !selectedEvent) return;
    const stakeAmount = Math.max(0, toNumber(stake));
    if (!stakeAmount) {
      sfx.error();
      return;
    }
    if (stakeAmount > wallet.balance) {
      sfx.error();
      setSettleMsg("Not enough balance for that bet — top up first.");
      return;
    }
    const { wallet: w1 } = openBet(wallet, {
      kind: "sports",
      game: selectedEvent.sport_title,
      label: `${selectedEvent.home_team} vs ${selectedEvent.away_team} — ${selected.outcomeName}`,
      eventId: selectedEvent.id,
      sportKey: selectedEvent.sport_key,
      commenceTime: new Date(selectedEvent.commence_time).getTime(),
      market: selected.marketKey,
      outcome: selected.outcomeName,
      point: bestPoint(selectedEvent, selected.marketKey, selected.outcomeName),
      odds: selected.price,
      stake: stakeAmount,
    });
    setWallet(w1);
    sfx.chip();
    setSettleMsg(`Bet placed · ${selected.outcomeName} @ ${selected.price.toFixed(2)} · win ${currency.format(stakeAmount * selected.price)}`);
    setSelected(null);
  }

  function cashOut(bet: Bet) {
    const price = cashoutPrice(bet);
    const next = cashOutBet(wallet, bet.id, price);
    if (!next) return;
    setWallet(next);
    const cashed = next.bets.find((b) => b.id === bet.id);
    if (cashed) onResult(cashed);
  }

  function evaluateBet(bet: Bet, se: ScoreEvent): "win" | "loss" | "push" | null {
    if (!se.scores || se.scores.length < 2) return null;
    const scores = new Map(se.scores.map((s) => [s.name.trim(), Number(s.score)]));
    const home = scores.get(se.home_team.trim());
    const away = scores.get(se.away_team.trim());
    if (home == null || away == null || Number.isNaN(home) || Number.isNaN(away)) return null;
    const outcome = bet.outcome ?? "";
    if (bet.market === "h2h") {
      if (outcome === se.home_team) return home > away ? "win" : "loss";
      if (outcome === se.away_team) return away > home ? "win" : "loss";
      if (outcome === "Draw") return home === away ? "win" : "loss";
      return null;
    }
    if (bet.market === "spreads") {
      const pt = bet.point ?? 0;
      if (outcome === se.home_team) return home + pt > away ? "win" : "loss";
      if (outcome === se.away_team) return away + pt > home ? "win" : "loss";
      return null;
    }
    if (bet.market === "totals") {
      const total = home + away;
      const pt = bet.point ?? 0;
      if (total === pt) return "push";
      if (outcome === "Over") return total > pt ? "win" : "loss";
      if (outcome === "Under") return total < pt ? "win" : "loss";
      return null;
    }
    return null;
  }

  async function settleResults() {
    const open = openSportsBets(latestWallet.current);
    if (!open.length) {
      setSettleMsg("No open sports bets — place one first.");
      return;
    }
    setSettling(true);
    sfx.countTick();
    const sportKeys = [...new Set(open.map((b) => b.sportKey).filter((k): k is string => Boolean(k)))];
    let current = latestWallet.current;
    let settled = 0;
    let total = 0;
    for (const key of sportKeys) {
      const res = await fetchScores(key);
      const map = new Map(res.data.map((e) => [e.id, e]));
      for (const bet of openSportsBets(current).filter((b) => b.sportKey === key)) {
        const se = map.get(bet.eventId ?? "");
        if (!se || !se.completed) continue;
        const verdict = evaluateBet(bet, se);
        if (verdict === "win") {
          current = settleBet(current, bet.id, true);
          settled++;
          total++;
        } else if (verdict === "loss") {
          current = settleBet(current, bet.id, false);
          total++;
        } else if (verdict === "push") {
          current = refundBet(current, bet.id);
          total++;
        }
      }
    }
    latestWallet.current = current;
    setWallet(current);
    setSettling(false);
    if (total > 0) {
      sfx.countTick();
      setSettleMsg(`${total} finished ${total === 1 ? "event" : "events"} settled — ${settled} won.`);
    } else {
      setSettleMsg("No finished events yet — refresh again after match completion.");
    }
  }

  function refreshOdds() {
    sfx.click();
    setSettleMsg(null);
    setLoadingOdds(true);
    fetchOdds(sportKey).then((res) => {
      const now = Date.now();
      setEvents(
        res.data.map((e) => ({
          ...e,
          xacheusLive: !e.completed && new Date(e.commence_time).getTime() < now,
        }))
      );
      setDemo(res.demo);
      setDemoError(res.error ?? null);
      setRemaining(res.remaining ?? null);
      setLoadingOdds(false);
      sfx.deal();
    });
  }

  const sportTitle = sportKey === "upcoming" ? "All Sports" : sports.find((s) => s.key === sportKey)?.title ?? sportKey;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
      <div className="min-w-0 space-y-4">
        {/* Sport chips */}
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {[{ key: "upcoming", title: "🔥 All Sports" }, ...sports.filter((s) => s.active || s.key === sportKey)].map((s) => (
            <button
              key={s.key}
              onClick={() => {
                sfx.click();
                setSelected(null);
                setSettleMsg(null);
                setLoadingOdds(true);
                setSportKey(s.key);
              }}
              className={`whitespace-nowrap rounded-full border px-4 py-2 text-xs font-bold transition ${sportKey === s.key ? "border-cyan-300/60 bg-cyan-300/15 text-cyan-100 shadow-[0_0_20px_rgba(34,211,238,.15)]" : "border-white/[0.08] bg-white/[0.04] text-slate-400 hover:border-white/20 hover:text-white"}`}
            >
              {s.title}
            </button>
          ))}
        </div>

        {/* Status bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-[#0d1425]/70 px-4 py-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="font-bold text-white">{sportTitle}</span>
            <span className="text-slate-500">{loadingOdds ? "loading odds…" : `${events.length} events`}</span>
            {remaining && <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] font-bold text-slate-400">📡 {remaining} API calls left</span>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refreshOdds} className="rounded-lg border border-white/10 bg-white/[0.045] px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10">Refresh odds</button>
            <button onClick={() => void settleResults()} disabled={settling} className="rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-400/20 disabled:opacity-60">
              {settling ? "Settling…" : "Settle results"}
            </button>
          </div>
        </div>

        {demo && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-300/25 bg-amber-300/[0.07] px-4 py-3 text-xs leading-5 text-amber-100">
            <span className="text-base">⚠️</span>
            <div>
              <p className="font-bold">Demo odds are active {demoError === "no-key" ? "— no API key configured" : demoError === "invalid-key" ? "— that API key was rejected" : "— odds service unreachable"}.</p>
              <p className="text-amber-100/70">Add your The Odds API key in Settings (⚙) for real bookmaker odds, or set <code className="rounded bg-black/30 px-1">ODDS_API_KEY</code> in your environment. Real data flows through the exact same pipeline.</p>
            </div>
          </div>
        )}

        {settleMsg && (
          <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.06] px-4 py-2.5 text-xs font-semibold text-cyan-100">{settleMsg}</div>
        )}

        {/* Events */}
        {loadingSports || loadingOdds ? (
          <div className="grid min-h-[300px] place-items-center rounded-3xl border border-white/[0.07] bg-[#0d1425]/60">
            <div className="text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-cyan-300/30 border-t-cyan-300" />
              <p className="mt-3 text-xs font-bold text-slate-400">Fetching the markets…</p>
            </div>
          </div>
        ) : events.length === 0 ? (
          <div className="grid min-h-[300px] place-items-center rounded-3xl border border-white/[0.07] bg-[#0d1425]/60">
            <p className="text-sm text-slate-500">No upcoming events for this sport right now.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <EventCard key={event.id} event={event} selected={selected} onSelect={selectOutcome} />
            ))}
          </div>
        )}
      </div>

      {/* Bet slip */}
      <aside className="h-fit rounded-3xl border border-white/[0.08] bg-[#0d1425]/90 p-5 shadow-2xl shadow-black/20 sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-white">Bet slip</h2>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold tracking-[0.12em] text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> LIVE PRICES
          </span>
        </div>

        {!selected ? (
          <div className="mt-6 rounded-2xl border border-dashed border-white/10 p-6 text-center">
            <p className="text-2xl">🎯</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">Tap an odds button on any event to add a selection to your slip.</p>
          </div>
        ) : (
          <div className="slip-pick mt-5 rounded-2xl border border-cyan-300/25 bg-cyan-300/[0.06] p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-bold tracking-[0.12em] text-slate-500">{selectedEvent?.sport_title} · {selected.marketKey === "h2h" ? "MATCH WINNER" : selected.marketKey === "spreads" ? "SPREAD" : "TOTAL"}</p>
                <p className="mt-1 truncate text-sm font-bold text-white">{selected.outcomeName}</p>
              </div>
              <button onClick={() => { sfx.click(); setSelected(null); }} className="rounded-md bg-white/[0.07] px-2 py-1 text-[10px] font-bold text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-slate-500">Odds</span>
              <span className="rounded-lg bg-emerald-400/15 px-2 py-0.5 font-black text-emerald-300">{selected.price.toFixed(2)}</span>
            </div>
          </div>
        )}

        <div className="mt-6">
          <div className="mb-2 flex justify-between text-[11px] font-bold text-slate-500">
            <label htmlFor="sports-bet">STAKE</label>
            <span>MAX {currency.format(wallet.balance)}</span>
          </div>
          <div className="flex rounded-xl border border-white/[0.1] bg-[#070b16] p-1 focus-within:border-cyan-300/50">
            <span className="grid w-9 place-items-center text-sm font-bold text-slate-500">$</span>
            <input
              disabled={!selected}
              id="sports-bet"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              inputMode="decimal"
              className="min-w-0 flex-1 bg-transparent py-2 text-base font-bold text-white outline-none disabled:cursor-not-allowed disabled:opacity-50"
            />
            <button disabled={!selected} onClick={() => setStake(String(Math.min(wallet.balance, betAmount ? betAmount * 2 : 25)))} className="rounded-lg bg-white/[0.07] px-2.5 text-[10px] font-bold text-slate-300 hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-50">2×</button>
          </div>
          <div className="mt-2 grid grid-cols-5 gap-2">
            {[5, 10, 25, 50, 100].map((value) => (
              <button disabled={!selected} key={value} onClick={() => setStake(String(value))} className="rounded-lg border border-white/[0.07] bg-white/[0.035] py-2 text-[11px] font-bold text-slate-400 transition hover:border-cyan-300/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-50">${value}</button>
            ))}
          </div>
        </div>

        {selected && (
          <div className="mt-5 space-y-2 rounded-xl bg-white/[0.03] p-3 text-xs">
            <div className="flex justify-between"><span className="text-slate-500">Stake</span><span className="font-semibold text-slate-200">{currency.format(betAmount)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Odds</span><span className="font-semibold text-slate-200">{selected.price.toFixed(2)}</span></div>
            <div className="flex justify-between border-t border-white/[0.07] pt-2"><span className="text-slate-500">To win</span><span className="font-black text-emerald-300">{currency.format(betAmount * selected.price)}</span></div>
          </div>
        )}

        <button disabled={!selected} onClick={placeBet} className="bet-btn mt-6 w-full rounded-xl px-4 py-3.5 text-sm font-black text-slate-950 shadow-lg shadow-emerald-400/10 transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40">
          {selected ? `PLACE BET · ${currency.format(betAmount)}` : "SELECT A BET FIRST"}
        </button>

        {/* Open bets */}
        <div className="mt-7">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] font-bold tracking-[0.15em] text-slate-500">OPEN BETS · {openBets.length}</p>
          </div>
          {openBets.length === 0 ? (
            <p className="text-[11px] leading-4 text-slate-600">No open bets. Place one above and settle it when the game finishes.</p>
          ) : (
            <div className="space-y-2">
              {openBets.map((bet) => {
                const price = cashoutPrice(bet);
                return (
                  <div key={bet.id} className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
                    <p className="text-[10px] font-bold tracking-[0.1em] text-slate-500">{bet.game}</p>
                    <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-200">{bet.label}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">{currency.format(bet.stake)} @ <b className="text-white">{bet.odds.toFixed(2)}</b></span>
                      <button onClick={() => cashOut(bet)} className="rounded-lg bg-emerald-400/10 px-2.5 py-1 text-[10px] font-black text-emerald-300 transition hover:bg-emerald-400/25">
                        CASH OUT {currency.format(Math.round(bet.stake * Math.max(1, price * 0.8) * 100) / 100)}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function EventCard({
  event,
  selected,
  onSelect,
}: {
  event: OddsEvent;
  selected: Selected | null;
  onSelect: (event: OddsEvent, marketKey: string, outcome: OddsOutcome) => void;
}) {
  const h2h = marketOutcomes(event, "h2h");
  const spreads = marketOutcomes(event, "spreads");
  const totals = marketOutcomes(event, "totals");
  const completed = Boolean(event.completed);
  const scoreText =
    completed && event.scores
      ? event.scores.map((s) => `${s.name} ${s.score}`).join(" · ")
      : null;

  const isSelected = (marketKey: string, outcomeName: string) =>
    selected?.eventId === event.id && selected.marketKey === marketKey && selected.outcomeName === outcomeName;

  return (
    <div className={`rounded-2xl border bg-[#0d1425]/70 p-4 transition ${completed ? "border-white/[0.05] opacity-75" : "border-white/[0.08] hover:border-white/[0.16]"}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.1em]">
          <span className="text-slate-500">{event.sport_title.toUpperCase()}</span>
          <span className={`rounded-full px-2 py-0.5 ${completed ? "bg-white/[0.07] text-slate-400" : event.xacheusLive ? "bg-rose-400/15 text-rose-300" : "bg-cyan-300/10 text-cyan-300"}`}>
            {completed ? "FINAL" : formatCommence(event.commence_time)}
          </span>
        </div>
        {scoreText && <span className="text-[10px] font-bold text-slate-400">{scoreText}</span>}
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 flex-1 truncate text-sm font-bold text-white">{event.home_team}</span>
        <span className="text-[10px] font-black text-slate-600">VS</span>
        <span className="min-w-0 flex-1 truncate text-right text-sm font-bold text-white">{event.away_team}</span>
      </div>

      {h2h.length > 0 && (
        <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: `repeat(${h2h.length}, minmax(0,1fr))` }}>
          {h2h.map((outcome) => (
            <button
              key={outcome.name}
              disabled={completed}
              onClick={() => onSelect(event, "h2h", outcome)}
              className={`odds-btn rounded-xl border px-2 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${isSelected("h2h", outcome.name) ? "border-cyan-300/60 bg-cyan-300/15 shadow-[0_0_18px_rgba(34,211,238,.18)]" : "border-white/[0.08] bg-white/[0.04] hover:border-emerald-300/40 hover:bg-emerald-300/[0.07]"}`}
            >
              <span className="block truncate text-[10px] font-semibold text-slate-400">{outcome.name}</span>
              <span className="block text-sm font-black text-white">{outcome.price.toFixed(2)}</span>
            </button>
          ))}
        </div>
      )}

      {spreads.length > 0 && (
        <MarketRow label="SPREAD" event={event} marketKey="spreads" outcomes={spreads} selected={selected} onSelect={onSelect} />
      )}
      {totals.length > 0 && (
        <MarketRow label="TOTAL" event={event} marketKey="totals" outcomes={totals} selected={selected} onSelect={onSelect} />
      )}
    </div>
  );
}

function MarketRow({
  label,
  event,
  marketKey,
  outcomes,
  selected,
  onSelect,
}: {
  label: string;
  event: OddsEvent;
  marketKey: string;
  outcomes: OddsOutcome[];
  selected: Selected | null;
  onSelect: (event: OddsEvent, marketKey: string, outcome: OddsOutcome) => void;
}) {
  return (
    <div className="mt-2 grid grid-cols-2 gap-2">
      {outcomes.slice(0, 2).map((outcome) => {
        const point = outcome.point !== undefined ? `${outcome.point > 0 ? "+" : ""}${outcome.point}` : "";
        return (
          <button
            key={`${marketKey}-${outcome.name}-${point}`}
            disabled={Boolean(event.completed)}
            onClick={() => onSelect(event, marketKey, outcome)}
            className={`odds-btn flex items-center justify-between gap-2 rounded-xl border px-3 py-2 transition disabled:cursor-not-allowed disabled:opacity-50 ${isSelected(selected, event.id, marketKey, outcome.name) ? "border-cyan-300/60 bg-cyan-300/15 shadow-[0_0_18px_rgba(34,211,238,.18)]" : "border-white/[0.07] bg-white/[0.03] hover:border-emerald-300/40 hover:bg-emerald-300/[0.07]"}`}
          >
            <span className="min-w-0">
              <span className="block truncate text-left text-[9px] font-bold tracking-[0.1em] text-slate-500">{label}</span>
              <span className="block truncate text-left text-[11px] font-bold text-slate-200">{outcome.name}{point ? ` ${point}` : ""}</span>
            </span>
            <span className="text-sm font-black text-white">{outcome.price.toFixed(2)}</span>
          </button>
        );
      })}
    </div>
  );
}

function isSelected(selected: Selected | null, eventId: string, marketKey: string, outcomeName: string) {
  return selected?.eventId === eventId && selected.marketKey === marketKey && selected.outcomeName === outcomeName;
}
