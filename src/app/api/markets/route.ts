import { NextResponse } from "next/server";
import { INITIAL_MARKETS } from "@/lib/simulation/initialMarkets";

export async function GET() {
  // Return current market quotes with dynamic simulated drift
  const markets = INITIAL_MARKETS.map((m) => {
    const drift = (Math.random() - 0.49) * 0.001;
    const price = parseFloat((m.price * (1 + drift)).toFixed(m.precision));
    return {
      ...m,
      price,
      timestamp: new Date().toISOString(),
    };
  });

  return NextResponse.json({
    success: true,
    data: markets,
    timestamp: new Date().toISOString(),
  });
}
