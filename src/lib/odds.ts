/**
 * Client-side helpers for The Odds API (v4) — proxied through our own
 * route handler (/api/odds) so the API key never needs to ship to the
 * browser in your production bundle. The key is stored in localStorage
 * (personal/dev use) or in the ODDS_API_KEY env var (deployments).
 */

import { demoOdds, demoScores, demoSports } from "./demoOdds";

export type OddsSport = {
  key: string;
  title: string;
  group: string;
  active: boolean;
  has_outrights: boolean;
  description: string;
};

export type OddsOutcome = { name: string; price: number; point?: number };
export type OddsMarket = { key: "h2h" | "spreads" | "totals"; outcomes: OddsOutcome[] };
export type OddsBookmaker = { key: string; title: string; markets: OddsMarket[] };

export type OddsEvent = {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  completed?: boolean;
  scores?: { name: string; score: string }[] | null;
  bookmakers: OddsBookmaker[];
  /** Client-computed at fetch time (avoids Date.now() during render). */
  xacheusLive?: boolean;
};

export type ScoreEvent = {
  id: string;
  sport_key: string;
  completed: boolean;
  home_team: string;
  away_team: string;
  scores: { name: string; score: string }[] | null;
};

export type OddsResponse<T> = {
  demo: boolean;
  error?: string;
  remaining?: string | null;
  data: T;
};

const KEY_STORAGE = "xacheus-odds-key";

export function getApiKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}

export function setApiKey(key: string) {
  try {
    localStorage.setItem(KEY_STORAGE, key.trim());
  } catch {
    /* ignore */
  }
}

export function hasServerKey(): boolean {
  // Populated server-side at build/request time via the odds route.
  return false;
}

type FetchOpts = {
  action?: "sports" | "odds" | "scores";
  sportKey?: string;
  regions?: string;
  markets?: string;
};

async function oddsFetch<T>(opts: FetchOpts): Promise<OddsResponse<T>> {
  const params = new URLSearchParams();
  if (opts.action) params.set("action", opts.action);
  if (opts.sportKey) params.set("sportKey", opts.sportKey);
  if (opts.regions) params.set("regions", opts.regions);
  if (opts.markets) params.set("markets", opts.markets);

  const headers: Record<string, string> = {};
  const key = getApiKey();
  if (key) headers["x-odds-api-key"] = key;

  try {
    const res = await fetch(`/api/odds?${params.toString()}`, { headers, cache: "no-store" });
    const body = (await res.json()) as OddsResponse<T>;
    if (!body || typeof body !== "object") throw new Error("bad payload");
    return body;
  } catch {
    // Offline / route error → graceful demo fallback.
    const action = opts.action ?? "sports";
    return {
      demo: true,
      error: "network",
      data:
        action === "sports"
          ? (demoSports() as T)
          : action === "scores"
            ? (demoScores(opts.sportKey ?? "upcoming") as T)
            : (demoOdds(opts.sportKey ?? "upcoming") as T),
    };
  }
}

export function fetchSports(): Promise<OddsResponse<OddsSport[]>> {
  return oddsFetch<OddsSport[]>({ action: "sports" });
}

export function fetchOdds(sportKey: string): Promise<OddsResponse<OddsEvent[]>> {
  return oddsFetch<OddsEvent[]>({
    action: "odds",
    sportKey,
    regions: "eu,uk",
    markets: "h2h,spreads,totals",
  });
}

export function fetchScores(sportKey: string): Promise<OddsResponse<ScoreEvent[]>> {
  return oddsFetch<ScoreEvent[]>({ action: "scores", sportKey, regions: "eu,uk" });
}

/** Best available price for an outcome across all bookmakers. */
export function bestPrice(event: OddsEvent, marketKey: string, outcomeName: string): number {
  let best = 0;
  for (const book of event.bookmakers) {
    const market = book.markets.find((m) => m.key === marketKey);
    if (!market) continue;
    for (const out of market.outcomes) {
      if (out.name === outcomeName && out.price > best) best = out.price;
    }
  }
  return best;
}

/** The line (spread/total point) offered for an outcome across bookmakers. */
export function bestPoint(event: OddsEvent, marketKey: string, outcomeName: string): number | undefined {
  for (const book of event.bookmakers) {
    const market = book.markets.find((m) => m.key === marketKey);
    if (!market) continue;
    for (const out of market.outcomes) {
      if (out.name === outcomeName && out.point !== undefined) return out.point;
    }
  }
  return undefined;
}

export function marketOutcomes(event: OddsEvent, marketKey: string): OddsOutcome[] {
  const merged = new Map<string, OddsOutcome>();
  for (const book of event.bookmakers) {
    const market = book.markets.find((m) => m.key === marketKey);
    if (!market) continue;
    for (const out of market.outcomes) {
      const current = merged.get(out.name);
      if (!current || out.price > current.price) merged.set(out.name, out);
    }
  }
  return Array.from(merged.values());
}

export function formatCommence(iso: string): string {
  const date = new Date(iso);
  const now = Date.now();
  const diff = date.getTime() - now;
  if (diff < -30 * 60 * 1000) return "Final";
  if (diff < 0) return "Live";
  if (diff < 3600_000) {
    const mins = Math.max(1, Math.round(diff / 60_000));
    return `in ${mins}m`;
  }
  if (diff < 24 * 3600_000) {
    const hours = Math.round(diff / 3600_000);
    return `in ${hours}h`;
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
