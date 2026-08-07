import { NextRequest, NextResponse } from "next/server";

/**
 * Deposit endpoint — Stripe-ready.
 *
 * When STRIPE_SECRET_KEY is set, creates a real Stripe Checkout Session
 * (via Stripe's REST API, no SDK needed) and returns the hosted URL.
 * Otherwise returns a sandbox response and the client credits the wallet
 * instantly, which keeps the whole flow usable in dev/preview.
 *
 * NOTE: in production you must credit the wallet server-side (webhook or
 * the /api/checkout/confirm flow) against a real ledger — see src/db.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_DEPOSIT = 5;
const MAX_DEPOSIT = 10000;

export async function POST(req: NextRequest) {
  let amount = 0;
  try {
    const body = await req.json();
    amount = Math.round(Number(body?.amount) * 100) / 100;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!Number.isFinite(amount) || amount < MIN_DEPOSIT || amount > MAX_DEPOSIT) {
    return NextResponse.json(
      { error: `Deposit must be between $${MIN_DEPOSIT} and $${MAX_DEPOSIT}` },
      { status: 400 }
    );
  }

  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();

  if (!secretKey) {
    return NextResponse.json({
      sandbox: true,
      amount,
      note: "Sandbox deposit — set STRIPE_SECRET_KEY to enable real card payments.",
    });
  }

  const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  const form = new URLSearchParams({
    mode: "payment",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(Math.round(amount * 100)),
    "line_items[0][price_data][product_data][name]": "Xacheus Betting — balance top-up",
    success_url: `${origin}/?deposit_session={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/?deposit=cancelled`,
  });

  try {
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: data?.error?.message ?? "Stripe could not create the checkout session." },
        { status: 400 }
      );
    }
    return NextResponse.json({ url: data.url, sessionId: data.id });
  } catch {
    return NextResponse.json(
      { error: "Could not reach Stripe. Check STRIPE_SECRET_KEY and network access." },
      { status: 502 }
    );
  }
}
