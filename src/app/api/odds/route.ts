import { NextRequest, NextResponse } from "next/server";
import { demoScores, demoOdds, demoSports } from "../../../lib/demoOdds";

/**
 * Proxy for The Odds API (v4) — keeps the API key on the server.
 *
 * Key resolution: ODDS_API_KEY env var > "x-odds-api-key" header
 * (set from the in-app Settings panel) > ?apiKey= query param.
 *
 * Whenever the upstream is unavailable, missing a key, or rejects the
 * key, this route returns clearly-labeled demo data so the whole site
 * keeps working and the UI shows a "DEMO ODDS" banner.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BASE = "https://api.the-odds-api.com/v4";

function demoPayload(action: string, sportKey: string) {
  if (action === "sports") return demoSports();
  if (action === "scores") return demoScores(sportKey);
  return demoOdds(sportKey);
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const action = sp.get("action") ?? "sports";
  const sportKey = sp.get("sportKey") ?? "upcoming";
  const regions = sp.get("regions") ?? "eu,uk";
  const markets = sp.get("markets") ?? "h2h,spreads,totals";
  const daysFrom = sp.get("daysFrom") ?? "1";

  const key =
    process.env.ODDS_API_KEY?.trim() ||
    req.headers.get("x-odds-api-key")?.trim() ||
    sp.get("apiKey")?.trim() ||
    "";

  if (!key) {
    return NextResponse.json({
      demo: true,
      error: "no-key",
      remaining: null,
      data: demoPayload(action, sportKey),
    });
  }

  let url: string;
  if (action === "sports") {
    url = `${BASE}/sports/?apiKey=${encodeURIComponent(key)}`;
  } else if (action === "scores") {
    url = `${BASE}/sports/${encodeURIComponent(sportKey)}/scores/?apiKey=${encodeURIComponent(key)}&daysFrom=${encodeURIComponent(daysFrom)}`;
  } else {
    url = `${BASE}/sports/${encodeURIComponent(sportKey)}/odds/?apiKey=${encodeURIComponent(key)}&regions=${encodeURIComponent(regions)}&markets=${encodeURIComponent(markets)}&oddsFormat=decimal`;
  }

  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    const remaining = res.headers.get("x-requests-remaining");

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 401 || res.status === 403) {
        return NextResponse.json({
          demo: true,
          error: "invalid-key",
          remaining,
          data: demoPayload(action, sportKey),
          upstream: text.slice(0, 300),
        });
      }
      return NextResponse.json({
        demo: true,
        error: `upstream-${res.status}`,
        remaining,
        data: demoPayload(action, sportKey),
        upstream: text.slice(0, 300),
      });
    }

    const data = await res.json();
    return NextResponse.json({ demo: false, remaining, data });
  } catch {
    // Network blocked / timeout (e.g. sandboxed previews) → demo mode.
    return NextResponse.json({
      demo: true,
      error: "network",
      remaining: null,
      data: demoPayload(action, sportKey),
    });
  }
}
