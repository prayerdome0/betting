import { NextResponse } from "next/server";

interface ServerWithdrawal {
  id: string;
  amount: number;
  method: string;
  destination: string;
  status: "PENDING" | "SIMULATED_APPROVED" | "CANCELLED";
  createdAt: string;
  notes: string;
}

let serverWithdrawals: ServerWithdrawal[] = [];

export async function GET() {
  return NextResponse.json({
    success: true,
    data: serverWithdrawals,
  });
}

export async function POST(req: Request) {
  try {
    const { amount, method, destination } = await req.json();

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid withdrawal amount" },
        { status: 400 }
      );
    }

    if (!destination || destination.trim().length < 4) {
      return NextResponse.json(
        { success: false, error: "Invalid payment destination" },
        { status: 400 }
      );
    }

    const newRequest: ServerWithdrawal = {
      id: `WD-${Math.floor(10000 + Math.random() * 90000)}`,
      amount: parseFloat(amount.toFixed(2)),
      method: method || "USDT_TRC20",
      destination: destination.trim(),
      status: "PENDING",
      createdAt: new Date().toISOString(),
      notes: "Simulated prototype withdrawal — recorded in demo ledger.",
    };

    serverWithdrawals.unshift(newRequest);

    return NextResponse.json({
      success: true,
      message: "Withdrawal Request Received. Your request has been recorded.",
      data: newRequest,
      notice: "This prototype does not transfer real funds.",
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
