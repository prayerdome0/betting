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
export type ApiFailure = Error & { status?: number };

/**
 * Idempotency keys must exist outside secure contexts too: `crypto.randomUUID`
 * is undefined on plain HTTP (LAN previews, containers), which used to abort
 * every command with a TypeError instead of reaching the server.
 */
export function commandKey() {
  const webCrypto = globalThis.crypto;
  if (webCrypto && typeof webCrypto.randomUUID === "function")
    return webCrypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (webCrypto?.getRandomValues) webCrypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Server, gateway and platform error bodies all look different (JSON with a
 * string `error`, JSON with `{ error: { message } }`, Vercel HTML, empty body).
 * Every shape becomes one readable sentence instead of "Unexpected token <" or
 * "[object Object]".
 */
function describeResponse(response: Response, text: string) {
  if (text) {
    try {
      const parsed = JSON.parse(text) as unknown;
      const value = (parsed as { error?: unknown } | null)?.error;
      if (typeof value === "string" && value.trim()) return value.trim();
      if (value && typeof value === "object") {
        const message = (value as { message?: unknown }).message;
        if (typeof message === "string" && message.trim()) return message.trim();
        const code = (value as { code?: unknown }).code;
        if (code !== undefined) return `Request failed (${String(code)}).`;
      }
      if (typeof parsed === "string" && parsed.trim()) return parsed.trim();
    } catch {
      /* Not JSON — fall through to the raw text. */
    }
    const plain = text
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (plain) return plain.slice(0, 240);
  }
  return `Request failed (HTTP ${response.status}).`;
}

export async function api(user: User, path: string, body?: unknown) {
  const key = commandKey();
  const send = async (token: string) => {
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
    try {
      return await fetch(path, options);
    } catch {
      return await fetch(path, options);
    }
  };

  let response = await send(await user.getIdToken());
  if (response.status === 401) {
    // An expired/restored session is normal after a reload or a sleeping phone:
    // force one token refresh before telling the user to sign in again.
    try {
      response = await send(await user.getIdToken(true));
    } catch {
      /* keep the original 401 below */
    }
  }

  const text = await response.text().catch(() => "");
  if (!response.ok) {
    const failure: ApiFailure = new Error(describeResponse(response, text));
    failure.status = response.status;
    throw failure;
  }
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`The server returned an unreadable response (HTTP ${response.status}).`);
  }
}

/** Actionable wording for the account bootstrap that runs right after sign-in. */
function describeInitializeFailure(error: unknown) {
  const message =
    error instanceof Error && error.message
      ? error.message
      : "Account initialization failed.";
  const status = (error as ApiFailure).status;
  if (status === 401) return `${message} Sign in again to continue.`;
  if (status && status >= 500)
    return `Your account could not be created yet — the server rejected the request. ${message}`;
  return message;
}

const INITIALIZE_ATTEMPTS = 5;
const INITIALIZE_BASE_DELAY_MS = 2000;
const INITIALIZE_MAX_DELAY_MS = 30000;

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
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let accountLoaded = false;
    let bootstrapError = false;

    const db = getDbInstance();
    const root = `users/${user.uid}`;
    const fail = (e: Error) => {
      setError(`Firestore: ${e.message}`);
      setConnectionFailed(true);
    };

    /**
     * Signing in is not enough: the Firestore account is created by the server
     * (client writes are denied by the rules). A single failed request used to
     * leave a brand-new user on "Connecting your persistent account" forever,
     * so the bootstrap is retried with a bounded backoff until it succeeds or
     * the account document arrives.
     */
    const initialize = async () => {
      if (!active || accountLoaded) return;
      try {
        await api(user, "/api/command", { action: "initialize" });
        bootstrapError = false;
        if (active) setError("");
      } catch (e) {
        if (!active || accountLoaded) return;
        bootstrapError = true;
        setError(describeInitializeFailure(e));
        if (attempt < INITIALIZE_ATTEMPTS) {
          const delay = Math.min(
            INITIALIZE_MAX_DELAY_MS,
            INITIALIZE_BASE_DELAY_MS * 2 ** attempt,
          );
          attempt += 1;
          timer = setTimeout(initialize, delay);
        }
      }
    };
    void initialize();

    const unsubs = [
      onSnapshot(
        doc(db, root),
        { includeMetadataChanges: true },
        (s) => {
          const exists = s.exists();
          if (exists) accountLoaded = true;
          setAccount(exists ? (s.data() as Account) : null);
          setFromCache(s.metadata.fromCache);
          if (!s.metadata.fromCache) setConnectionFailed(false);
          // The account exists, so a stale bootstrap complaint is no longer true.
          if (exists && bootstrapError) {
            bootstrapError = false;
            setError("");
          }
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
      if (timer) clearTimeout(timer);
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
        setNotice(result.message ?? "");
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
