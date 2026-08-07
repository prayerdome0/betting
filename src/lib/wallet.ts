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

export type Bet = {
  id: string;
  kind: "sports" | "casino";
  game: string; // sport title for sports bets, game title for casino
  label: string; // outcome or round description
  eventId?: string;
  sportKey?: string;
  commenceTime?: number;
  market?: string; // h2h | spreads | totals (sports bets)
  outcome?: string; // outcome/team name (sports bets)
  point?: number; // spread/total line
  odds: number;
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

/** Cash out an open bet early at the current odds (discounted). */
export function cashOutBet(wallet: Wallet, id: string, currentOdds: number): Wallet | null {
  const next = cloneWallet(wallet);
  const bet = next.bets.find((b) => b.id === id);
  if (!bet || bet.status !== "open") return null;
  const cashOdds = Math.max(1, Math.round(currentOdds * 0.8 * 100) / 100);
  bet.status = "cashed";
  bet.payout = Math.round(bet.stake * cashOdds * 100) / 100;
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
