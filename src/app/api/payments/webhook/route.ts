import { NextRequest, NextResponse } from "next/server";
import {
  extractPaymentId,
  extractReference,
  extractStatus,
  isSuccessStatus,
  recordWebhookEvent,
  verifyWebhookSignature,
} from "@/lib/ontech";

/**
 * OnTech payment webhook — receives payment confirmations.
 *
 * The gateway's exact payload is not publicly documented, so the handler
 * is defensive: it pulls the reference/status from common field shapes and
 * always answers 200 (with a signature failure → 401) to stop retries.
 *
 * Production note: persist confirmations to the server-side ledger here.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  if (!rawBody) {
    return NextResponse.json({ error: "Empty body" }, { status: 400 });
  }

  if (!verifyWebhookSignature(rawBody, req.headers)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const reference = extractReference(body);
  const status = extractStatus(body);
  const confirmed = isSuccessStatus(status);

  if (!reference) {
    // No reference we can act on — acknowledge so the gateway stops retrying.
    return NextResponse.json({ received: true, ignored: true });
  }

  recordWebhookEvent(reference, body, status ?? "success");
  return NextResponse.json({ received: true, confirmed, reference, status: status ?? null });
}
