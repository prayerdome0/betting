"use client";
import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { getDbInstance } from "./firebase";
import type {
  Account,
  Activity,
  Feed,
  LedgerEntry,
  Session,
  Trade,
  Withdrawal,
} from "./trading/types";
import type { ServiceHealth } from "./trading/status";
import { connectionLabel } from "./trading/status";
import { useOnline } from "./useOnline";
export type Health = ServiceHealth;
export async function api(user: User, path: string, body?: unknown) {
  const token = await user.getIdToken();
  const key = crypto.randomUUID();
  const options = {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": key,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  };
  // A network retry reuses the same key, so a committed command cannot apply twice.
  let response: Response;
  try {
    response = await fetch(path, options);
  } catch {
    response = await fetch(path, options);
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}
export function useTrading(user: User | null) {
  const online = useOnline();
  const [fromCache, setFromCache] = useState(true);
  const [connectionFailed, setConnectionFailed] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [tradeLimit, setTradeLimit] = useState(50);
  const [positions, setPositions] = useState<Trade[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [feed, setFeed] = useState<Feed | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [clockOffset, setClockOffset] = useState(0);
  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const before = Date.now();
        const response = await fetch("/api/health", {
          signal: AbortSignal.timeout(10000),
        });
        const result = await response.json();
        if (active) {
          setHealth(result);
          setClockOffset(result.serverTime - (before + Date.now()) / 2);
        }
      } catch {
        if (active) setHealth(null);
      }
    };
    void check();
    window.addEventListener("online", check);
    const interval = setInterval(check, 15000);
    return () => {
      active = false;
      window.removeEventListener("online", check);
      clearInterval(interval);
    };
  }, []);
  useEffect(() => {
    if (!user) return;
    let active = true;
    void api(user, "/api/command", { action: "initialize" }).catch((e) => {
      if (active) setError(e.message);
    });
    const db = getDbInstance();
    const root = `users/${user.uid}`;
    const fail = (e: Error) => {
      setError(`Firestore: ${e.message}`);
      setConnectionFailed(true);
    };
    const unsubs = [
      onSnapshot(
        doc(db, root),
        { includeMetadataChanges: true },
        (s) => {
          setAccount(s.exists() ? (s.data() as Account) : null);
          setFromCache(s.metadata.fromCache);
          if (!s.metadata.fromCache) setConnectionFailed(false);
        },
        fail,
      ),
      onSnapshot(
        query(
          collection(db, `${root}/tradingSessions`),
          orderBy("startedAt", "desc"),
          limit(100),
        ),
        (s) => setSessions(s.docs.map((d) => d.data() as Session)),
        fail,
      ),
      onSnapshot(
        query(collection(db, `${root}/trades`), where("status", "==", "OPEN")),
        (s) => setPositions(s.docs.map((d) => d.data() as Trade)),
        fail,
      ),
      onSnapshot(
        query(
          collection(db, `${root}/activity`),
          orderBy("sequence", "desc"),
          limit(100),
        ),
        (s) => setActivity(s.docs.map((d) => d.data() as Activity)),
        fail,
      ),
      onSnapshot(
        query(
          collection(db, `${root}/ledger`),
          orderBy("sequence", "desc"),
          limit(100),
        ),
        (s) => setLedger(s.docs.map((d) => d.data() as LedgerEntry)),
        fail,
      ),
      onSnapshot(
        query(
          collection(db, `${root}/withdrawals`),
          orderBy("createdAt", "desc"),
          limit(100),
        ),
        (s) => setWithdrawals(s.docs.map((d) => d.data() as Withdrawal)),
        fail,
      ),
      onSnapshot(
        doc(db, "system/market"),
        (s) => setFeed(s.exists() ? (s.data() as Feed) : null),
        fail,
      ),
    ];
    return () => {
      active = false;
      unsubs.forEach((fn) => fn());
    };
  }, [user]);
  // Expand the live query in pages. Previously loaded OPEN trades continue to
  // receive settlement updates rather than becoming stale one-shot snapshots.
  useEffect(() => {
    if (!user) return;
    return onSnapshot(
      query(
        collection(getDbInstance(), `users/${user.uid}/trades`),
        orderBy("startedAt", "desc"),
        orderBy("__name__", "desc"),
        limit(tradeLimit),
      ),
      (snapshot) => {
        setTrades(snapshot.docs.map((d) => d.data() as Trade));
        setHasMore(snapshot.size === tradeLimit);
      },
      (error) => setError(`Firestore: ${error.message}`),
    );
  }, [user, tradeLimit]);
  const command = useCallback(
    async (body: unknown) => {
      if (!user)
        throw new Error("Sign in to use your persistent trading account.");
      if (!online) {
        setError(
          "You are offline. No command was sent. Existing sessions may continue on the independent worker.",
        );
        return false;
      }
      setBusy(true);
      setError("");
      try {
        const result = await api(user, "/api/command", body);
        setNotice(result.message);
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Request failed.");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [user, online],
  );
  function moreTrades() {
    if (user && hasMore) setTradeLimit((current) => current + 50);
  }
  return {
    connection:
      !user && online
        ? "Sign in to connect your private account"
        : connectionLabel({
            online,
            fromCache,
            accountExists: !!account,
            failed: connectionFailed,
          }),
    connected: online && !fromCache && !connectionFailed,
    browserOnline: online,
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
    setError,
    busy,
    notice,
    setNotice,
    command,
    moreTrades,
    hasMore,
    clockOffset,
  };
}
