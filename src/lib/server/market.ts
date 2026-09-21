import { createHash } from "node:crypto";
import { db } from "./firebase";
import type { Feed, Quote } from "../trading/types";
export const TICK_MS = 5000;
const SEEDS: Omit<Quote, "history" | "changePct">[] = [
  { symbol: "EUR/USD", name: "Euro / US Dollar", price: 1.08425, precision: 5 },
  {
    symbol: "GBP/USD",
    name: "British Pound / US Dollar",
    price: 1.27384,
    precision: 5,
  },
  { symbol: "XAU/USD", name: "Gold / US Dollar", price: 2641.52, precision: 2 },
  {
    symbol: "BTC/USD",
    name: "Bitcoin / US Dollar",
    price: 67482.3,
    precision: 2,
  },
];
// Provider boundary: replace with a licensed feed adapter, not with UI-generated prices.
export interface MarketDataProvider {
  next(previous: Feed | null, now: number): Feed;
}
export class SyntheticMarketProvider implements MarketDataProvider {
  next(previous: Feed | null, now: number): Feed {
    const time = Math.floor(now / TICK_MS) * TICK_MS;
    return {
      source: "SYNTHETIC",
      updatedAt: time,
      quotes: SEEDS.map((seed) => {
        const old = previous?.quotes.find((q) => q.symbol === seed.symbol);
        if (old && (!Number.isFinite(old.price) || old.price <= 0))
          throw new Error(
            "Synthetic feed has an invalid prior price. Refusing to silently reset market history.",
          );
        const random =
          createHash("sha256")
            .update(`${seed.symbol}:${time}`)
            .digest()
            .readUInt32BE(0) / 0xffffffff;
        const volatility = seed.symbol === "BTC/USD" ? 0.004 : 0.0015;
        const price = Number(
          (
            (old ? old.price : seed.price) *
            (1 + (random * 2 - 1) * volatility)
          ).toFixed(seed.precision),
        );
        const history = [...(old?.history || []), { time, price }].slice(-120);
        return {
          ...seed,
          price,
          history,
          changePct: (price / history[0].price - 1) * 100,
        };
      }),
    };
  }
}
export async function updateFeed(now: number) {
  const ref = db().doc("system/market");
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const prev = snap.exists ? (snap.data() as Feed) : null;
    if (prev && now - prev.updatedAt < TICK_MS) return prev;
    const feed = new SyntheticMarketProvider().next(prev, now);
    tx.set(ref, feed);
    return feed;
  });
}
