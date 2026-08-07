import { NextRequest, NextResponse } from "next/server";
import { checkGatewayStatus, getWebhookEvent } from "@/lib/ontech";

/**
 * Payment confirmation check.
 *   GET /api/deposit/status?reference=…&paymentId=…
 *
 * Checks our webhook event store first (authoritative), then asks the
 * gateway for the payment status as a fallback.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const reference = req.nextUrl.searchParams.get("reference");
  const paymentId = req.nextUrl.searchParams.get("paymentId");
  if (!reference) {
    return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  }

  const event = getWebhookEvent(reference);
  if (event) {
    return NextResponse.json({
      confirmed: true,
      source: "webhook",
      status: typeof event.status === "string" ? event.status : "success",
      receivedAt: typeof event.receivedAt === "number" ? event.receivedAt : Date.now(),
    });
  }

  const gateway = await checkGatewayStatus(paymentId, reference);
  if (gateway.confirmed) {
    return NextResponse.json({ confirmed: true, source: "gateway", status: gateway.status ?? "success" });
  }

  return NextResponse.json({
    confirmed: false,
    source: gateway.status ? "gateway" : "none",
    status: gateway.status ?? null,
  });
}
