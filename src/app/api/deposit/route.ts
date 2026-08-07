import { NextRequest, NextResponse } from "next/server";
import { collectPayment, generateReference, normalizePhone } from "@/lib/ontech";

/**
 * Initiate a Mobile Money deposit via the OnTech payment gateway.
 *   POST /api/deposit  { amount, phone }
 *
 * - amount: USD number (5 – 10,000). The gateway's merchant account
 *   determines the settled currency (amount passed as-is, per gateway docs).
 * - phone:  Zambian mobile number (09XXXXXXXX, +260..., 260...).
 *
 * Responses:
 *   { ok, confirmed: true, reference, sandbox? }        → credit immediately
 *   { ok, confirmed: false, reference, paymentId }      → poll /api/deposit/status
 *   { error }                                            → gateway rejected it
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let amount = 0;
  let phone = "";
  try {
    const body = await req.json();
    amount = Math.round(Number(body?.amount) * 100) / 100;
    phone = String(body?.phone ?? "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!Number.isFinite(amount) || amount < 5 || amount > 10000) {
    return NextResponse.json({ error: "Deposit must be between $5 and $10,000" }, { status: 400 });
  }

  const normalized = normalizePhone(phone);
  if (!normalized) {
    return NextResponse.json(
      { error: "A valid Zambian mobile number is required (e.g. 0976123456)" },
      { status: 400 }
    );
  }

  const reference = generateReference();
  const result = await collectPayment({
    amount,
    phone: normalized,
    reference,
    description: `Xacheus Betting top-up ${reference}`,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Payment could not be initiated." }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    sandbox: Boolean(result.sandbox),
    confirmed: Boolean(result.confirmed),
    reference,
    paymentId: result.paymentId ?? null,
    status: result.status ?? null,
    gatewayError: result.sandbox ? (result.error ?? null) : null,
  });
}
