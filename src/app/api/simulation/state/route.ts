import { NextResponse } from "next/server";
import { INITIAL_CLOSED_TRADES } from "@/lib/simulation/initialData";

// In-memory server-side ledger fallback
let serverLedger = {
  balance: 500.0,
  startingBalance: 500.0,
  openPositions: [],
  closedTrades: INITIAL_CLOSED_TRADES,
  withdrawals: [],
  aiEnabled: false,
  tradeAmount: 10.0,
  maxOpenTrades: 3,
  lastUpdated: new Date().toISOString(),
};

export async function GET() {
  return NextResponse.json({
    success: true,
    data: serverLedger,
    serverTime: new Date().toISOString(),
    environment: "SIMULATION_SANDBOX",
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (body.action === "RESET") {
      serverLedger.balance = 500.0;
      serverLedger.openPositions = [];
      serverLedger.closedTrades = INITIAL_CLOSED_TRADES;
      serverLedger.withdrawals = [];
      serverLedger.lastUpdated = new Date().toISOString();
      return NextResponse.json({ success: true, message: "Reset to $500.00 demo baseline." });
    }

    if (typeof body.balance === "number") {
      serverLedger.balance = body.balance;
    }

    serverLedger.lastUpdated = new Date().toISOString();
    return NextResponse.json({ success: true, data: serverLedger });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
