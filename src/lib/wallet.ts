/**
 * Xacheus Betting — wallet & ledger.
 *
 * Persisted in localStorage so the demo works with zero infrastructure.
 * The API shape mirrors what a real ledger (Postgres via src/db) would
 * expose, so swapping in a server-side wallet later is straightforward.
 */

import type { OddsEvent } from "./odds";
import { bestPrice } from "./odds";

export type BetStatus = "open" | "won" | "lost" | "cashed";

/** One leg of a parlay (accumulator) bet. */
export type ParlayLeg = {
  eventId: string;
  sportKey: string;
  market: string; // h2h | spreads | totals
  outcome: string;
  point?: number;
  odds: number;
  eventLabel: string; // "Arsenal vs Chelsea"
  commenceTime?: number;
};

export type Bet = {
  id: string;
  kind: "sports" | "casino";
  game: string; // sport title for sports bets, "Parlay" for accumulators, game title for casino
  label: string; // outcome or round description
  eventId?: string;
  sportKey?: string;
  commenceTime?: number;
  market?: string; // h2h | spreads | totals (single sports bets)
  outcome?: string; // outcome/team name (single sports bets)
  point?: number; // spread/total line
  legs?: ParlayLeg[]; // present for parlay bets
  odds: number; // combined odds for parlays
  stake: number;
  payout: number; // 0 until settled
  status: BetStatus;
  createdAt: number;
};

export type MoneyMove = {
  id: string;
  amount: number; // positive = deposit, negative = withdrawal request
  method: string;
  note?: string;
  time: number;
};

export type Wallet = {
  balance: number;
  bonus: number; // free "welcome" credits never part of deposits
  bets: Bet[];
  moves: MoneyMove[];
};

const KEY = "xacheus-wallet-v1";
const BONUS = 250;

export function loadWallet(): Wallet {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Wallet;
      if (typeof parsed.balance === "number" && Array.isArray(parsed.bets)) return parsed;
    }
  } catch {
    /* fall through to fresh wallet */
  }
  return { balance: BONUS, bonus: BONUS, bets: [], moves: [] };
}

export function saveWallet(wallet: Wallet) {
  try {
    localStorage.setItem(KEY, JSON.stringify(wallet));
  } catch {
    /* ignore */
  }
}

export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function cloneWallet(wallet: Wallet): Wallet {
  return JSON.parse(JSON.stringify(wallet)) as Wallet;
}

/** Deduct stake and record an open bet. Returns new wallet + bet. */
export function openBet(wallet: Wallet, partial: Omit<Bet, "id" | "payout" | "status" | "createdAt">): { wallet: Wallet; bet: Bet } {
  const next = cloneWallet(wallet);
  const bet: Bet = {
    ...partial,
    id: uid(),
    payout: 0,
    status: "open",
    createdAt: Date.now(),
  };
  next.bets = [bet, ...next.bets];
  next.balance = Math.round((next.balance - bet.stake) * 100) / 100;
  return { wallet: next, bet };
}

/** Settle an open bet. won=true credits stake × odds as payout. */
export function settleBet(wallet: Wallet, id: string, won: boolean): Wallet {
  const next = cloneWallet(wallet);
  const bet = next.bets.find((b) => b.id === id);
  if (!bet || bet.status !== "open") return wallet;
  bet.status = won ? "won" : "lost";
  bet.payout = won ? Math.round(bet.stake * bet.odds * 100) / 100 : 0;
  if (won) next.balance = Math.round((next.balance + bet.payout) * 100) / 100;
  return next;
}

export function combinedOdds(legs: ParlayLeg[]): number {
  return Math.round(legs.reduce((product, leg) => product * leg.odds, 1) * 100) / 100;
}

/** Open a parlay: deduct stake once, combined odds = product of legs. */
export function openParlay(
  wallet: Wallet,
  partial: Omit<Bet, "id" | "payout" | "status" | "createdAt" | "odds" | "kind"> & { legs: ParlayLeg[] }
): { wallet: Wallet; bet: Bet } {
  const next = cloneWallet(wallet);
  const bet: Bet = {
    ...partial,
    kind: "sports",
    odds: combinedOdds(partial.legs),
    id: uid(),
    payout: 0,
    status: "open",
    createdAt: Date.now(),
  };
  next.bets = [bet, ...next.bets];
  next.balance = Math.round((next.balance - bet.stake) * 100) / 100;
  return { wallet: next, bet };
}

/**
 * Settle a parlay from per-leg results.
 * - any loss → the parlay loses
 * - all legs push → stake refunded
 * - otherwise → won with the reduced combined odds (pushed legs drop out)
 */
export function settleParlay(wallet: Wallet, id: string, results: ("win" | "loss" | "push")[]): Wallet {
  const next = cloneWallet(wallet);
  const bet = next.bets.find((b) => b.id === id);
  if (!bet || bet.status !== "open" || !bet.legs) return wallet;
  if (bet.legs.length !== results.length) return wallet;

  const losses = results.filter((r) => r === "loss").length;
  if (losses > 0) {
    bet.status = "lost";
    bet.payout = 0;
    return next;
  }
  const pushes = results.filter((r) => r === "push").length;
  if (pushes === results.length) {
    bet.status = "cashed";
    bet.payout = bet.stake;
    next.balance = Math.round((next.balance + bet.payout) * 100) / 100;
    return next;
  }
  let multiplier = 1;
  results.forEach((result, index) => {
    if (result === "win" && bet.legs) multiplier *= bet.legs[index].odds;
  });
  bet.status = "won";
  bet.payout = Math.round(bet.stake * multiplier * 100) / 100;
  next.balance = Math.round((next.balance + bet.payout) * 100) / 100;
  return next;
}

/**
 * Cash out an open bet for an explicit cash value (fair value computed by
 * the caller from live odds, with margin). Capped at the max win, floored
 * at $0.01 so a losing-looking position can still be cashed out cheaply.
 */
export function cashOutBet(wallet: Wallet, id: string, cashValue: number): Wallet | null {
  const next = cloneWallet(wallet);
  const bet = next.bets.find((b) => b.id === id);
  if (!bet || bet.status !== "open") return null;
  const maxWin = Math.round(bet.stake * bet.odds * 100) / 100;
  const payout = Math.min(Math.max(cashValue, 0.01), maxWin);
  bet.status = "cashed";
  bet.payout = Math.round(payout * 100) / 100;
  next.balance = Math.round((next.balance + bet.payout) * 100) / 100;
  return next;
}

/** Credit a deposit. */
export function depositWallet(wallet: Wallet, amount: number, method: string, note?: string): Wallet {
  const next = cloneWallet(wallet);
  next.balance = Math.round((next.balance + amount) * 100) / 100;
  next.moves = [{ id: uid(), amount, method, note, time: Date.now() }, ...next.moves];
  return next;
}

/** Record a withdrawal request (sandbox — real payouts need a processor). */
export function requestWithdrawal(wallet: Wallet, amount: number): Wallet | null {
  if (amount <= 0 || amount > wallet.balance) return null;
  const next = cloneWallet(wallet);
  next.balance = Math.round((next.balance - amount) * 100) / 100;
  next.moves = [
    { id: uid(), amount: -amount, method: "Withdrawal request", note: "Pending manual review", time: Date.now() },
    ...next.moves,
  ];
  return next;
}

/** Mark a bet refunded (e.g. a push on a total line) at stake value. */
export function refundBet(wallet: Wallet, id: string): Wallet {
  const next = cloneWallet(wallet);
  const bet = next.bets.find((b) => b.id === id);
  if (!bet || bet.status !== "open") return wallet;
  bet.status = "cashed";
  bet.payout = bet.stake;
  next.balance = Math.round((next.balance + bet.payout) * 100) / 100;
  return next;
}

/** Fresh wallet (welcome bonus restored). */
export function resetWallet(): Wallet {
  return { balance: BONUS, bonus: BONUS, bets: [], moves: [] };
}

export function openSportsBets(wallet: Wallet): Bet[] {
  return wallet.bets.filter((b) => b.status === "open" && b.kind === "sports");
}

/** Best current price for an open bet (falls back to original odds). */
export function currentOddsFor(
  bet: Bet,
  events: Map<string, { event: OddsEvent; marketKey: string; outcomeName: string }>
): number {
  const entry = events.get(bet.eventId ?? "");
  if (!entry) return bet.odds;
  const price = bestPrice(entry.event, entry.marketKey, entry.outcomeName);
  return price > 0 ? price : bet.odds;
}
