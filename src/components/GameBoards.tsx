"use client";

import { useMemo, useRef, useState } from "react";
import sfx from "@/lib/sound";
import { currency } from "@/lib/money";
import type { Bet, Wallet } from "@/lib/wallet";
import { openBet, settleBet } from "@/lib/wallet";

export type GameId =
  | "coin"
  | "roulette"
  | "dice"
  | "plinko"
  | "slots"
  | "mines"
  | "crash"
  | "towers";

export type Game = {
  id: GameId;
  title: string;
  label: string;
  description: string;
  icon: string;
  tint: string;
  accent: string;
};

export const GAMES: Game[] = [
  { id: "coin", title: "Coin Flip", label: "CLASSIC", description: "Call the flip. Double the stakes.", icon: "◐", tint: "from-cyan-400/20 to-blue-600/5", accent: "text-cyan-200" },
  { id: "roulette", title: "Roulette", label: "TABLE", description: "Pick a color and let it spin.", icon: "◎", tint: "from-rose-500/20 to-orange-500/5", accent: "text-rose-200" },
  { id: "dice", title: "Dice Roll", label: "INSTANT", description: "Set your chance. Roll for a payout.", icon: "⚄", tint: "from-violet-500/20 to-fuchsia-500/5", accent: "text-violet-200" },
  { id: "plinko", title: "Plinko", label: "ARCADE", description: "Drop through the multiplier maze.", icon: "✦", tint: "from-amber-400/20 to-yellow-500/5", accent: "text-amber-100" },
  { id: "slots", title: "Lucky Slots", label: "SPIN", description: "Three reels. One big moment.", icon: "▦", tint: "from-pink-500/20 to-purple-600/5", accent: "text-pink-100" },
  { id: "mines", title: "Mines", label: "STRATEGY", description: "Find gems, avoid the hidden mines.", icon: "✹", tint: "from-emerald-400/20 to-teal-500/5", accent: "text-emerald-100" },
  { id: "crash", title: "Sky Crash", label: "LIVE", description: "Cash out before the rocket bursts.", icon: "↗", tint: "from-blue-500/20 to-indigo-600/5", accent: "text-blue-100" },
  { id: "towers", title: "Towers", label: "PICK", description: "Climb higher for every safe step.", icon: "▰", tint: "from-lime-400/20 to-green-500/5", accent: "text-lime-100" },
];

const rouletteRed = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

type ResultTone = "neutral" | "win" | "loss";

type CasinoTabProps = {
  wallet: Wallet;
  setWallet: (wallet: Wallet) => void;
  onResult: (bet: Bet) => void;
};

export default function CasinoTab({ wallet, setWallet, onResult }: CasinoTabProps) {
  const [selectedGame, setSelectedGame] = useState<GameId>("coin");
  const [amount, setAmount] = useState("25");
  const [coinPick, setCoinPick] = useState<"Heads" | "Tails">("Heads");
  const [roulettePick, setRoulettePick] = useState<"Red" | "Black">("Red");
  const [diceTarget, setDiceTarget] = useState(55);
  const [mineTiles, setMineTiles] = useState<number[]>([]);
  const [mineReveal, setMineReveal] = useState<number | null>(null);
  const [mineWasHit, setMineWasHit] = useState(false);
  const [towersStep, setTowersStep] = useState(0);
  const [result, setResult] = useState("Ready when you are.");
  const [resultTone, setResultTone] = useState<ResultTone>("neutral");
  const [lastRoll, setLastRoll] = useState<number | null>(null);
  const [lastRoulette, setLastRoulette] = useState<number | null>(null);
  const [coinFace, setCoinFace] = useState<"Heads" | "Tails">("Heads");
  const [slotReels, setSlotReels] = useState(["✦", "7", "♦"]);
  const [plinkoMultiplier, setPlinkoMultiplier] = useState<number | null>(null);
  const [crashPoint, setCrashPoint] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [roundKey, setRoundKey] = useState(0);
  const [history, setHistory] = useState<{ game: string; result: string; amount: number; change: number; id: number }[]>([]);
  const pendingRef = useRef<{ wallet: Wallet; bet: Bet } | null>(null);

  const game = useMemo(() => GAMES.find((item) => item.id === selectedGame) ?? GAMES[0], [selectedGame]);
  const bet = Math.max(0, Number(amount) || 0);
  const diceMultiplier = (99 / Math.max(5, 100 - diceTarget)).toFixed(2);

  function addHistory(entry: { game: string; result: string; amount: number; change: number }) {
    setHistory((current) => [{ ...entry, id: Date.now() }, ...current].slice(0, 6));
  }

  /** Open the wallet bet (stake deducted) — returns the recorded bet. */
  function holdBet(label: string, odds: number): Bet {
    const { wallet: w1, bet: placed } = openBet(wallet, {
      kind: "casino",
      game: game.title,
      label,
      odds,
      stake: bet,
    });
    pendingRef.current = { wallet: w1, bet: placed };
    setWallet(w1);
    return placed;
  }

  /** Settle the held bet, notify the app shell (banner/confetti/sfx). */
  function settleRound(won: boolean, label: string) {
    const pending = pendingRef.current;
    if (!pending) return;
    const w2 = settleBet(pending.wallet, pending.bet.id, won);
    pendingRef.current = null;
    setWallet(w2);
    const finalBet = w2.bets.find((b) => b.id === pending.bet.id) ?? pending.bet;
    const change = finalBet.payout - finalBet.stake;
    addHistory({ game: finalBet.game, result: finalBet.label, amount: finalBet.stake, change });
    setResult(won ? `Nice! ${label}` : label);
    setResultTone(won ? "win" : "loss");
    onResult(finalBet);
  }

  function beginRound(message: string, duration: number, finish: () => void) {
    setIsPlaying(true);
    setRoundKey((current) => current + 1);
    setResult(message);
    setResultTone("neutral");
    window.setTimeout(() => {
      finish();
      setIsPlaying(false);
    }, duration);
  }

  function playGame() {
    if (isPlaying) return;
    if (!bet || bet > wallet.balance) {
      sfx.error();
      setResult(bet > wallet.balance ? "Not enough balance for that bet." : "Enter a bet amount first.");
      setResultTone("loss");
      return;
    }

    if (selectedGame === "coin") {
      const landed = Math.random() < 0.5 ? "Heads" : "Tails";
      holdBet(`${coinPick} · Coin Flip`, 2);
      sfx.coinFlip();
      beginRound("Coin is in the air…", 1350, () => {
        setCoinFace(landed);
        sfx.thud();
        settleRound(landed === coinPick, `${landed} landed`);
      });
      return;
    }
    if (selectedGame === "roulette") {
      const number = Math.floor(Math.random() * 37);
      const color = number === 0 ? "Green" : rouletteRed.has(number) ? "Red" : "Black";
      holdBet(`${roulettePick} · Roulette`, 2);
      sfx.wheelSpin();
      beginRound("No more bets — wheel is spinning…", 2100, () => {
        setLastRoulette(number);
        sfx.thud();
        settleRound(color === roulettePick, `${number} · ${color}`);
      });
      return;
    }
    if (selectedGame === "dice") {
      const roll = Math.ceil(Math.random() * 100);
      const won = roll >= diceTarget;
      holdBet(`Roll ${diceTarget}+ · Dice`, Number(diceMultiplier));
      sfx.diceRoll();
      setLastRoll(null);
      beginRound("Rolling the dice…", 950, () => {
        setLastRoll(roll);
        settleRound(won, `Rolled ${roll} · needed ${diceTarget}+`);
      });
      return;
    }
    if (selectedGame === "plinko") {
      const multipliers = [0, 0.2, 0.4, 0.7, 1, 1.4, 2.2, 5];
      const landed = multipliers[Math.floor(Math.random() * multipliers.length)];
      holdBet(`Plinko · ${landed}×`, landed || 0.001);
      sfx.plinkoDrop();
      setPlinkoMultiplier(null);
      beginRound("Ball is dropping through the board…", 1600, () => {
        setPlinkoMultiplier(landed);
        settleRound(landed >= 1, `Landed on ${landed}×`);
      });
      return;
    }
    if (selectedGame === "slots") {
      const icons = ["7", "♦", "✦", "♛", "●"];
      const reels = Array.from({ length: 3 }, () => icons[Math.floor(Math.random() * icons.length)]);
      const isJackpot = reels[0] === reels[1] && reels[1] === reels[2];
      const isPair = reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2];
      holdBet(isJackpot ? "Jackpot spin" : isPair ? "Pair spin" : "Slots spin", isJackpot ? 8 : isPair ? 1.5 : 0.001);
      sfx.reelSpin();
      beginRound("Reels are spinning…", 1550, () => {
        setSlotReels(reels);
        sfx.reelStop();
        sfx.reelStop();
        settleRound(isJackpot || isPair, isJackpot ? "Jackpot! Three matching reels" : isPair ? "Pair found" : "No matching reels");
      });
      return;
    }
    if (selectedGame === "mines") {
      const tile = Math.floor(Math.random() * 25);
      const hitMine = Math.random() < 0.23;
      holdBet(`Mines · ${hitMine ? "mine" : "gem"}`, hitMine ? 0.001 : 1.35);
      sfx.dig();
      setMineReveal(null);
      beginRound("Searching the grid…", 800, () => {
        setMineReveal(tile);
        setMineWasHit(hitMine);
        if (!hitMine) {
          setMineTiles((current) => [...current.slice(-5), tile]);
          sfx.gem();
        } else {
          sfx.boom();
        }
        settleRound(!hitMine, hitMine ? "A mine was hiding there" : "A bright gem uncovered");
      });
      return;
    }
    if (selectedGame === "crash") {
      const point = Number((1 + Math.random() * 4.2).toFixed(2));
      const cashAt = 1.8;
      holdBet(`Auto cashout 1.8× · Crash`, cashAt);
      sfx.whoosh();
      setCrashPoint(null);
      beginRound("Rocket is flying…", 2300, () => {
        setCrashPoint(point);
        if (point < cashAt) sfx.boom();
        settleRound(point >= cashAt, point >= cashAt ? `Cashed out at ${cashAt}×` : `Rocket exploded at ${point}×`);
      });
      return;
    }
    const safe = Math.random() < 0.68;
    holdBet(`Tower floor ${towersStep + 1}`, safe ? 1.45 : 0.001);
    sfx.step();
    beginRound("Climbing the next floor…", 1050, () => {
      if (safe) {
        setTowersStep((current) => Math.min(current + 1, 4));
        sfx.step();
      } else {
        setTowersStep(0);
        sfx.boom();
      }
      settleRound(safe, safe ? `Safe step · floor ${towersStep + 1}` : "The tower crumbled");
    });
  }

  function changeGame(id: GameId) {
    if (isPlaying) return;
    sfx.click();
    setSelectedGame(id);
    setResult("Pick a stake and place your bet.");
    setResultTone("neutral");
  }

  return (
    <div className="space-y-6">
      {/* Game selector */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {GAMES.map((item) => (
          <button
            disabled={isPlaying}
            key={item.id}
            onClick={() => changeGame(item.id)}
            className={`group rounded-2xl border p-3 text-left transition duration-200 disabled:cursor-not-allowed disabled:opacity-55 ${selectedGame === item.id
              ? "border-cyan-300/50 bg-cyan-300/[0.10] shadow-[0_0_0_1px_rgba(103,232,249,.12),0_18px_38px_rgba(14,116,144,.16)]"
              : "border-white/[0.07] bg-white/[0.035] hover:border-white/[0.17] hover:bg-white/[0.065]"}`}
          >
            <div className={`mb-3 grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br ${item.tint} text-lg ${item.accent}`}>{item.icon}</div>
            <p className="text-[13px] font-bold text-white">{item.title}</p>
            <p className="mt-0.5 text-[10px] text-slate-500">{item.description}</p>
            <p className={`mt-2 text-[9px] font-bold tracking-[0.14em] ${selectedGame === item.id ? "text-cyan-300" : "text-slate-600"}`}>{item.label}</p>
          </button>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
        {/* Board */}
        <div className="overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0d1425]/80 shadow-2xl shadow-black/20">
          <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className={`grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br ${game.tint} text-lg ${game.accent}`}>{game.icon}</div>
              <div>
                <p className="text-sm font-bold text-white">{game.title}</p>
                <p className="text-[10px] font-bold tracking-[0.13em] text-slate-500">{game.label} GAME</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.045] px-2.5 py-1 text-[10px] font-bold tracking-[0.12em] text-slate-300">
              <span className="text-cyan-300">●</span> PROVABLY RANDOM
            </span>
          </div>
          <div className="grid min-h-[420px] place-items-center p-5 sm:p-8">
            {selectedGame === "coin" && <CoinBoard pick={coinPick} setPick={setCoinPick} face={coinFace} isPlaying={isPlaying} roundKey={roundKey} />}
            {selectedGame === "roulette" && <RouletteBoard pick={roulettePick} setPick={setRoulettePick} result={lastRoulette} isPlaying={isPlaying} roundKey={roundKey} />}
            {selectedGame === "dice" && <DiceBoard target={diceTarget} setTarget={setDiceTarget} lastRoll={lastRoll} multiplier={diceMultiplier} isPlaying={isPlaying} roundKey={roundKey} />}
            {selectedGame === "plinko" && <PlinkoBoard multiplier={plinkoMultiplier} isPlaying={isPlaying} roundKey={roundKey} />}
            {selectedGame === "slots" && <SlotsBoard reels={slotReels} isPlaying={isPlaying} roundKey={roundKey} />}
            {selectedGame === "mines" && <MinesBoard tiles={mineTiles} reveal={mineReveal} hitMine={mineWasHit} isPlaying={isPlaying} roundKey={roundKey} />}
            {selectedGame === "crash" && <CrashBoard crashPoint={crashPoint} isPlaying={isPlaying} roundKey={roundKey} />}
            {selectedGame === "towers" && <TowersBoard step={towersStep} isPlaying={isPlaying} roundKey={roundKey} />}
          </div>
        </div>

        {/* Bet panel */}
        <aside className="h-fit rounded-3xl border border-white/[0.08] bg-[#0d1425]/90 p-5 shadow-2xl shadow-black/20 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-white">Place bet</h2>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/20 bg-violet-400/10 px-2.5 py-1 text-[10px] font-bold tracking-[0.12em] text-violet-200">INSTANT</span>
          </div>
          <div className="mt-6">
            <div className="mb-2 flex justify-between text-[11px] font-bold text-slate-500">
              <label htmlFor="casino-bet">BET AMOUNT</label>
              <span>MAX {currency.format(wallet.balance)}</span>
            </div>
            <div className="flex rounded-xl border border-white/[0.1] bg-[#070b16] p-1 focus-within:border-cyan-300/50">
              <span className="grid w-9 place-items-center text-sm font-bold text-slate-500">$</span>
              <input
                disabled={isPlaying}
                id="casino-bet"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="decimal"
                className="min-w-0 flex-1 bg-transparent py-2 text-base font-bold text-white outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
              <button disabled={isPlaying} onClick={() => setAmount(String(Math.min(wallet.balance, bet ? bet * 2 : 25)))} className="rounded-lg bg-white/[0.07] px-2.5 text-[10px] font-bold text-slate-300 hover:bg-white/[0.12] disabled:cursor-not-allowed disabled:opacity-50">2×</button>
            </div>
            <div className="mt-2 grid grid-cols-5 gap-2">
              {[5, 10, 25, 50, 100].map((value) => (
                <button disabled={isPlaying} key={value} onClick={() => setAmount(String(value))} className="rounded-lg border border-white/[0.07] bg-white/[0.035] py-2 text-[11px] font-bold text-slate-400 transition hover:border-cyan-300/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-50">${value}</button>
              ))}
            </div>
          </div>

          <div className="my-6 border-t border-white/[0.08]" />
          <div className="space-y-3">
            <div className="flex justify-between text-xs"><span className="text-slate-500">Game</span><span className="font-semibold text-slate-200">{game.title}</span></div>
            <div className="flex justify-between text-xs"><span className="text-slate-500">Potential return</span><span className="font-semibold text-emerald-300">Up to {currency.format(selectedGame === "slots" ? bet * 8 : selectedGame === "plinko" ? bet * 5 : selectedGame === "crash" ? bet * 1.8 : selectedGame === "dice" ? bet * Number(diceMultiplier) : bet * 2)}</span></div>
            <div className="flex justify-between text-xs"><span className="text-slate-500">Your balance</span><span className="font-semibold text-slate-200">{currency.format(wallet.balance)}</span></div>
          </div>

          <button disabled={isPlaying} onClick={playGame} className="bet-btn mt-7 w-full rounded-xl px-4 py-3.5 text-sm font-black text-slate-950 shadow-lg shadow-emerald-400/10 transition hover:brightness-110 active:scale-[0.99] disabled:cursor-wait disabled:opacity-75">
            {isPlaying ? "ROUND IN PLAY…" : `BET ${currency.format(bet || 0)}`}
          </button>
          <div aria-live="polite" className={`mt-4 rounded-xl border px-3 py-3 text-center text-xs font-semibold ${isPlaying ? "round-status-active" : ""} ${resultTone === "win" ? "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-200" : resultTone === "loss" ? "border-rose-400/20 bg-rose-400/[0.08] text-rose-200" : "border-white/[0.07] bg-white/[0.035] text-slate-400"}`}>{result}</div>

          {history.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-[10px] font-bold tracking-[0.15em] text-slate-500">LAST ROUNDS</p>
              <div className="space-y-1.5">
                {history.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-1.5 text-[11px]">
                    <span className="truncate text-slate-400">{item.game}</span>
                    <span className={`font-bold ${item.change >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{item.change >= 0 ? "+" : ""}{currency.format(item.change)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Boards                                                              */
/* ------------------------------------------------------------------ */

function CoinBoard({ pick, setPick, face, isPlaying, roundKey }: { pick: "Heads" | "Tails"; setPick: (pick: "Heads" | "Tails") => void; face: "Heads" | "Tails"; isPlaying: boolean; roundKey: number }) {
  return (
    <div className="w-full max-w-xl text-center">
      <div className="coin-stage">
        <div key={roundKey} className={`casino-coin ${isPlaying ? "is-flipping" : ""}`}>
          <div className="coin-surface">
            <span className="text-5xl">{face === "Heads" ? "♛" : "♜"}</span>
            <small>{face}</small>
          </div>
        </div>
      </div>
      <p className="mt-8 text-sm font-bold text-white">{isPlaying ? "The coin is tumbling…" : "Call the coin"}</p>
      <p className="mt-1 text-xs text-slate-500">50% chance · 2.00× payout</p>
      <div className="mx-auto mt-5 flex max-w-xs rounded-xl bg-[#070b16] p-1">
        {(["Heads", "Tails"] as const).map((side) => (
          <button disabled={isPlaying} onClick={() => setPick(side)} key={side} className={`flex-1 rounded-lg py-2.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${pick === side ? "bg-cyan-300 text-slate-950 shadow-lg" : "text-slate-400 hover:text-white"}`}>{side}</button>
        ))}
      </div>
    </div>
  );
}

function RouletteBoard({ pick, setPick, result, isPlaying, roundKey }: { pick: "Red" | "Black"; setPick: (pick: "Red" | "Black") => void; result: number | null; isPlaying: boolean; roundKey: number }) {
  const slots = Array.from({ length: 18 }, (_, index) => index + 1);
  return (
    <div className="w-full max-w-xl text-center">
      <div className="roulette-stage">
        <span className="roulette-marker">▼</span>
        <div key={roundKey} className={`roulette-wheel ${isPlaying ? "is-spinning" : ""}`}>
          <div className="absolute inset-3 rounded-full border-4 border-dashed border-amber-100/45" />
          {slots.map((slot) => (
            <span key={slot} style={{ transform: `rotate(${slot * 20}deg) translateY(-101px) rotate(-${slot * 20}deg)` }} className={`absolute grid h-7 w-7 place-items-center rounded-full text-[8px] font-black ${rouletteRed.has(slot) ? "bg-rose-500 text-white" : "bg-slate-950 text-slate-200"}`}>{slot}</span>
          ))}
          <div className="grid h-20 w-20 place-items-center rounded-full border-4 border-amber-100/50 bg-emerald-600 text-2xl font-black text-white">{isPlaying ? "…" : result ?? "0"}</div>
        </div>
      </div>
      <p className="mt-7 text-sm font-bold text-white">{isPlaying ? "No more bets — wheel spinning" : "Choose a color"}</p>
      <div className="mx-auto mt-4 flex max-w-xs gap-2">
        {(["Red", "Black"] as const).map((color) => (
          <button disabled={isPlaying} key={color} onClick={() => setPick(color)} className={`flex-1 rounded-xl border py-2.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${pick === color ? color === "Red" ? "border-rose-300 bg-rose-500 text-white" : "border-white/40 bg-slate-950 text-white" : "border-white/10 bg-white/[.03] text-slate-400"}`}>{color}</button>
        ))}
      </div>
    </div>
  );
}

function DiceBoard({ target, setTarget, lastRoll, multiplier, isPlaying, roundKey }: { target: number; setTarget: (target: number) => void; lastRoll: number | null; multiplier: string; isPlaying: boolean; roundKey: number }) {
  return (
    <div className="w-full max-w-2xl">
      <div key={roundKey} className={`casino-die mx-auto grid h-36 w-36 place-items-center rounded-[2rem] border border-violet-200/25 bg-gradient-to-br from-violet-500/70 to-fuchsia-700/80 text-6xl font-black text-white shadow-[0_16px_50px_rgba(139,92,246,.25)] ${isPlaying ? "is-rolling" : ""}`}>{isPlaying ? "…" : lastRoll ?? "?"}</div>
      <div className="mx-auto mt-9 max-w-lg">
        <div className="flex justify-between text-xs font-bold">
          <span className="text-slate-400">Roll over <span className="text-white">{target}</span></span>
          <span className="text-violet-200">{multiplier}× payout</span>
        </div>
        <input disabled={isPlaying} type="range" min="5" max="95" value={target} onChange={(event) => setTarget(Number(event.target.value))} className="mt-4 w-full accent-violet-400 disabled:cursor-not-allowed disabled:opacity-50" />
        <div className="mt-2 flex justify-between text-[10px] font-bold text-slate-600"><span>5</span><span>50</span><span>95</span></div>
      </div>
    </div>
  );
}

function PlinkoBoard({ multiplier, isPlaying, roundKey }: { multiplier: number | null; isPlaying: boolean; roundKey: number }) {
  const dots = Array.from({ length: 28 });
  const cells = ["0×", "0.2×", "0.4×", "0.7×", "1×", "1.4×", "2.2×", "5×"];
  return (
    <div className="w-full max-w-xl text-center">
      <div className={`relative mx-auto h-[255px] max-w-[430px] overflow-hidden rounded-2xl border border-amber-200/10 bg-[radial-gradient(circle_at_50%_0%,rgba(251,191,36,.2),transparent_45%),#090d19] ${isPlaying ? "plinko-active" : ""}`}>
        <div key={roundKey} className={`plinko-ball ${isPlaying ? "is-dropping" : ""}`} />
        <div className="grid grid-cols-7 gap-x-6 gap-y-5 px-10 pt-12">
          {dots.map((_, index) => <i key={index} className="mx-auto h-2.5 w-2.5 rounded-full bg-amber-100/70 shadow-[0_0_10px_rgba(251,191,36,.7)]" />)}
        </div>
        <div className="absolute inset-x-2 bottom-2 grid grid-cols-8 gap-1">
          {cells.map((cell) => (
            <span key={cell} className={`rounded-md py-2 text-[9px] font-black transition duration-300 ${!isPlaying && cell === `${multiplier}×` ? "bg-emerald-300 text-slate-950 shadow-[0_0_18px_rgba(110,231,183,.75)]" : "bg-white/[.08] text-slate-400"}`}>{cell}</span>
          ))}
        </div>
      </div>
      <p className="mt-5 text-xs font-bold text-amber-100">{isPlaying ? "Following a randomized path…" : multiplier !== null ? `Last drop landed on ${multiplier}×` : "A randomized multiplier path awaits"}</p>
    </div>
  );
}

function SlotsBoard({ reels, isPlaying, roundKey }: { reels: string[]; isPlaying: boolean; roundKey: number }) {
  const isJackpot = !isPlaying && reels[0] === reels[1] && reels[1] === reels[2];
  return (
    <div className="w-full max-w-lg text-center">
      <div className={`relative rounded-[2rem] border-[7px] border-pink-300/70 bg-gradient-to-b from-fuchsia-600 to-violet-800 p-5 shadow-[0_22px_60px_rgba(192,38,211,.22)] ${isPlaying ? "slot-machine-active" : ""} ${isJackpot ? "is-jackpot" : ""}`}>
        {isJackpot && <div className="jackpot-rays" />}
        <div className="mb-3 flex justify-between px-3 text-[10px] font-black tracking-[0.2em] text-pink-100"><span>LUCKY</span><span>{isPlaying ? "SPIN" : isJackpot ? "JACKPOT!" : "777"}</span></div>
        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-[#180c37] p-3">
          {reels.map((reel, index) => (
            <div key={`${roundKey}-${index}`} className="slot-window grid aspect-square place-items-center overflow-hidden rounded-xl border border-violet-200/30 bg-gradient-to-b from-white to-pink-100 text-5xl text-violet-800 shadow-inner">
              <span style={{ animationDelay: `${index * 130}ms` }} className={isPlaying ? "slot-symbol is-spinning" : "slot-symbol"}>{isPlaying ? ["7", "♦", "✦"][index] : reel}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[10px] font-bold tracking-[0.16em] text-pink-100">{isPlaying ? "REELS IN MOTION" : "MATCH 3 TO WIN 8×"}</p>
      </div>
    </div>
  );
}

function MinesBoard({ tiles, reveal, hitMine, isPlaying, roundKey }: { tiles: number[]; reveal: number | null; hitMine: boolean; isPlaying: boolean; roundKey: number }) {
  return (
    <div className="w-full max-w-sm text-center">
      <div key={roundKey} className={`mines-grid grid grid-cols-5 gap-2 rounded-2xl border border-emerald-300/10 bg-[#091619] p-4 ${isPlaying ? "is-searching" : ""}`}>
        {Array.from({ length: 25 }, (_, index) => {
          const revealedNow = reveal === index;
          const previousGem = tiles.includes(index) && !revealedNow;
          const tileStyle = revealedNow ? hitMine ? "is-mine" : "is-gem" : previousGem ? "is-gem is-previous" : "is-hidden";
          return <div key={index} className={`mine-tile grid aspect-square place-items-center rounded-lg border text-sm ${tileStyle}`}>{revealedNow ? hitMine ? "✹" : "◆" : previousGem ? "◆" : "·"}</div>;
        })}
      </div>
      <p className="mt-5 text-xs font-bold text-emerald-100">{isPlaying ? "Scanner is choosing a tile…" : "Each round uncovers a random tile · avoid the mines"}</p>
    </div>
  );
}

function CrashBoard({ crashPoint, isPlaying, roundKey }: { crashPoint: number | null; isPlaying: boolean; roundKey: number }) {
  const exploded = !isPlaying && crashPoint !== null && crashPoint < 1.8;
  return (
    <div className="w-full max-w-xl text-center">
      <div className={`crash-board relative h-[230px] overflow-hidden rounded-2xl border border-blue-300/10 bg-[linear-gradient(180deg,rgba(37,99,235,.18),transparent_70%),#080d1f] ${isPlaying ? "is-flying" : ""} ${exploded ? "has-exploded" : ""}`}>
        {exploded && <div className="explosion-ring" />}
        <div className="absolute inset-x-0 bottom-0 h-px bg-blue-300/30" />
        <div className="crash-trail absolute bottom-6 left-[12%] h-px w-[78%] origin-left rotate-[-23deg] bg-gradient-to-r from-cyan-300 via-blue-400 to-transparent shadow-[0_0_18px_rgba(96,165,250,.8)]" />
        <span key={roundKey} className={`crash-rocket absolute right-[18%] top-[22%] text-5xl drop-shadow-[0_0_15px_rgba(125,211,252,.85)] ${isPlaying ? "is-launching" : ""}`}>{exploded ? "💥" : "🚀"}</span>
        <span className="absolute left-[20%] top-[18%] text-[10px] tracking-[.25em] text-blue-200/50">AUTO CASHOUT 1.80×</span>
        <div className="absolute inset-0 grid place-items-center">
          <div>
            <p className={`text-5xl font-black tracking-tight text-white ${isPlaying ? "crash-counter" : ""}`}>{isPlaying ? "↑" : crashPoint ? `${crashPoint}×` : "1.00×"}</p>
            <p className="mt-2 text-[10px] font-bold tracking-[0.16em] text-blue-200">{isPlaying ? "FLIGHT IN PROGRESS" : exploded ? "ROCKET EXPLODED" : crashPoint ? "LAST FLIGHT" : "READY FOR TAKEOFF"}</p>
          </div>
        </div>
      </div>
      <p className="mt-5 text-xs font-bold text-blue-100">Cash out is automatically set at 1.80×</p>
    </div>
  );
}

function TowersBoard({ step, isPlaying, roundKey }: { step: number; isPlaying: boolean; roundKey: number }) {
  const activeFloor = Math.min(step, 3);
  return (
    <div className="w-full max-w-md text-center">
      <div key={roundKey} className={`tower-board mx-auto flex h-[270px] max-w-[290px] flex-col-reverse gap-2 rounded-t-[2rem] border-x border-t border-lime-200/15 bg-[linear-gradient(180deg,rgba(132,204,22,.12),transparent)] p-4 ${isPlaying ? "is-climbing" : ""}`}>
        {[0, 1, 2, 3].map((floor) => (
          <div key={floor} className="grid flex-1 grid-cols-3 gap-2">
            {[0, 1, 2].map((cell) => {
              const isSafe = floor < step && cell === 1;
              const isTarget = isPlaying && floor === activeFloor && cell === 1;
              return <span key={cell} className={`tower-tile rounded-lg border ${isSafe ? "is-safe" : ""} ${isTarget ? "is-target" : ""}`}>{isSafe ? "✦" : isTarget ? "↑" : ""}</span>;
            })}
          </div>
        ))}
      </div>
      <p className="mt-5 text-xs font-bold text-lime-100">{isPlaying ? "Scaling the next floor…" : step ? `${step} safe ${step === 1 ? "floor" : "floors"} climbed` : "Climb safe floors to grow your multiplier"}</p>
    </div>
  );
}
