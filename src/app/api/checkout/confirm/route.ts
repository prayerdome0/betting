import { NextRequest, NextResponse } from "next/server";

/**
 * Confirms a Stripe Checkout Session after the user is redirected back
 * with ?deposit_session=... and returns the paid amount so the client
 * can credit the wallet. In production, credit the wallet server-side
 * here (or via webhook) against your real ledger instead.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json({ paid: false, error: "Missing session_id" }, { status: 400 });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    return NextResponse.json({ sandbox: true, paid: true, amount: 0 });
  }

  try {
    const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ paid: false, error: data?.error?.message ?? "Could not verify payment" }, { status: 400 });
    }
    const paid = data.payment_status === "paid";
    return NextResponse.json({
      paid,
      amount: paid ? (data.amount_total ?? 0) / 100 : 0,
      currency: data.currency,
    });
  } catch {
    return NextResponse.json({ paid: false, error: "Could not reach Stripe." }, { status: 502 });
  }
}
