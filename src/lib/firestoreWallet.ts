/**
 * Firestore wallet sync (client). One document per account:
 *   users/{uid}/wallet/current   → the full wallet (balance, bets, moves)
 *   users/{uid}/payments/{ref}   → paid references (deposit idempotency)
 *
 * All failures are swallowed so the app keeps working offline or with a
 * locked-down database (guest mode is always available).
 */

import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { getDbInstance } from "./firebase";
import type { Wallet } from "./wallet";

export type CloudWallet = Wallet & { updatedAt: number };

function walletDoc(uid: string) {
  return doc(getDbInstance(), "users", uid, "wallet", "current");
}

function paymentDoc(uid: string, reference: string) {
  return doc(getDbInstance(), "users", uid, "payments", reference);
}

function shapeWallet(data: Record<string, unknown>): CloudWallet {
  return {
    balance: Number(data.balance) || 0,
    bonus: Number(data.bonus) || 0,
    bets: Array.isArray(data.bets) ? (data.bets as Wallet["bets"]) : [],
    moves: Array.isArray(data.moves) ? (data.moves as Wallet["moves"]) : [],
    updatedAt: Number(data.updatedAt) || 0,
  };
}

export async function fetchCloudWallet(uid: string): Promise<CloudWallet | null> {
  try {
    const snap = await getDoc(walletDoc(uid));
    if (!snap.exists()) return null;
    return shapeWallet(snap.data() as Record<string, unknown>);
  } catch {
    return null;
  }
}

export function subscribeCloudWallet(uid: string, onUpdate: (wallet: CloudWallet | null) => void): () => void {
  return onSnapshot(
    walletDoc(uid),
    (snap) => {
      if (!snap.exists()) {
        onUpdate(null);
        return;
      }
      onUpdate(shapeWallet(snap.data() as Record<string, unknown>));
    },
    () => {
      /* permission/network errors — keep local state */
    }
  );
}

export async function writeCloudWallet(uid: string, wallet: Wallet, updatedAt?: number): Promise<void> {
  const now = updatedAt ?? Date.now();
  try {
    await setDoc(walletDoc(uid), { ...wallet, updatedAt: now });
  } catch {
    /* offline — keep local */
  }
}

export async function fetchCloudPayment(uid: string, reference: string): Promise<boolean> {
  try {
    const snap = await getDoc(paymentDoc(uid, reference));
    return snap.exists();
  } catch {
    return false;
  }
}

export async function recordCloudPayment(
  uid: string,
  reference: string,
  data: { amount: number; method: string; note?: string; time: number }
): Promise<void> {
  try {
    await setDoc(paymentDoc(uid, reference), { ...data, createdAt: Date.now() });
  } catch {
    /* ignore */
  }
}
