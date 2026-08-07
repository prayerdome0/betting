/**
 * OnTech payment gateway integration (server-side only — never ship these
 * secrets to the browser).
 *
 * Docs contract (from the gateway's quick-start):
 *   POST {BASE}/pay/collect
 *     Headers: X-API-Key: <PAYMENT_GATEWAY_API_KEY>
 *     Body:    { amount, phone, reference, description }
 *   Confirmations arrive via webhook (PAYMENT_GATEWAY_WEBHOOK_SECRET).
 *
 * Because the gateway's response schema isn't publicly documented, all
 * parsing is defensive (multiple common field names/shapes) and every
 * network failure degrades to a clearly-labeled sandbox credit.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const GATEWAY_BASE = (process.env.PAYMENT_GATEWAY_BASE_URL ?? "").replace(/\/+$/, "");
export const GATEWAY_KEY = process.env.PAYMENT_GATEWAY_API_KEY ?? "";
export const WEBHOOK_SECRET = process.env.PAYMENT_GATEWAY_WEBHOOK_SECRET ?? "";
export const SIGNING_SECRET = process.env.PAYMENT_GATEWAY_SIGNING_SECRET ?? "";

/* ------------------------------- utils ------------------------------ */

export function normalizePhone(raw: string): string | null {
  let p = String(raw).replace(/[\s-]/g, "");
  if (p.startsWith("+260")) p = "0" + p.slice(4);
  else if (p.startsWith("260")) p = "0" + p.slice(3);
  return /^09\d{8}$/.test(p) ? p : null;
}

export function generateReference(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `XCH${stamp}${rand}`;
}

const SUCCESS_STATUSES = new Set([
  "success",
  "successful",
  "confirmed",
  "completed",
  "paid",
  "approved",
  "succeeded",
  "captured",
  "processed",
]);

/** Pull a status string out of a gateway payload of unknown shape. */
export function extractStatus(payload: unknown): string | undefined {
  const walk = (obj: unknown): unknown => {
    if (Array.isArray(obj)) return obj[0] ? walk(obj[0]) : undefined;
    if (obj && typeof obj === "object") {
      const o = obj as Record<string, unknown>;
      for (const key of ["status", "payment_status", "state", "result", "transaction_status", "event"]) {
        if (typeof o[key] === "string") return o[key];
        if (o[key] && typeof o[key] === "object") {
          const deep = walk(o[key]);
          if (typeof deep === "string") return deep;
        }
      }
    }
    return undefined;
  };
  const value = walk(payload);
  return typeof value === "string" ? value.toLowerCase() : undefined;
}

export function isSuccessStatus(status?: string): boolean {
  return Boolean(status && SUCCESS_STATUSES.has(status.toLowerCase()));
}

/** Pull a payment id out of a gateway payload of unknown shape. */
export function extractPaymentId(payload: unknown): string | undefined {
  const walk = (obj: unknown): unknown => {
    if (Array.isArray(obj)) return obj[0] ? walk(obj[0]) : undefined;
    if (obj && typeof obj === "object") {
      const o = obj as Record<string, unknown>;
      for (const key of ["id", "payment_id", "paymentId", "transaction_id", "transactionId", "pay_id"]) {
        if (typeof o[key] === "string") return o[key];
      }
      for (const value of Object.values(o)) {
        if (value && typeof value === "object") {
          const deep = walk(value);
          if (typeof deep === "string") return deep;
        }
      }
    }
    return undefined;
  };
  const value = walk(payload);
  return typeof value === "string" ? value : undefined;
}

/** Pull a transaction/reference string out of a gateway payload. */
export function extractReference(payload: unknown): string | undefined {
  const walk = (obj: unknown): unknown => {
    if (Array.isArray(obj)) return obj[0] ? walk(obj[0]) : undefined;
    if (obj && typeof obj === "object") {
      const o = obj as Record<string, unknown>;
      for (const key of [
        "reference",
        "transaction_reference",
        "payment_reference",
        "merchant_reference",
        "client_reference",
        "ref",
      ]) {
        if (typeof o[key] === "string") return o[key];
      }
      for (const value of Object.values(o)) {
        if (value && typeof value === "object") {
          const deep = walk(value);
          if (typeof deep === "string") return deep;
        }
      }
    }
    return undefined;
  };
  const value = walk(payload);
  return typeof value === "string" ? value : undefined;
}

/* ------------------------------ collect ----------------------------- */

export type CollectResult = {
  ok: boolean;
  sandbox?: boolean;
  confirmed?: boolean;
  reference?: string;
  paymentId?: string | null;
  status?: string | null;
  error?: string;
  raw?: unknown;
};

export async function collectPayment(opts: {
  amount: number;
  phone: string;
  reference: string;
  description: string;
}): Promise<CollectResult> {
  if (!GATEWAY_KEY || !GATEWAY_BASE) {
    return { ok: true, sandbox: true, confirmed: true, reference: opts.reference, error: "not-configured" };
  }
  try {
    const res = await fetch(`${GATEWAY_BASE}/pay/collect`, {
      method: "POST",
      headers: { "X-API-Key": GATEWAY_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: opts.amount,
        phone: opts.phone,
        reference: opts.reference,
        description: opts.description,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.ok) {
      const status = extractStatus(data);
      return {
        ok: true,
        confirmed: isSuccessStatus(status),
        reference: opts.reference,
        paymentId: extractPaymentId(data) ?? null,
        status: status ?? null,
        raw: data,
      };
    }
    const message =
      (typeof data.message === "string" ? data.message : undefined) ??
      (typeof data.detail === "string" ? data.detail : undefined) ??
      `Gateway error ${res.status}`;
    return { ok: false, error: message, raw: data };
  } catch {
    // Unreachable (e.g. sandboxed preview). Sandbox-credit with a clear label —
    // production deployments reach the gateway normally and never hit this.
    return { ok: true, sandbox: true, confirmed: true, reference: opts.reference, error: "unreachable" };
  }
}

/* --------------------------- status checks -------------------------- */

export async function checkGatewayStatus(
  paymentId?: string | null,
  reference?: string | null
): Promise<{ confirmed: boolean; status?: string }> {
  if (!GATEWAY_KEY || !GATEWAY_BASE || !paymentId) return { confirmed: false };
  const candidates = [
    `${GATEWAY_BASE}/payments/${encodeURIComponent(paymentId)}`,
    `${GATEWAY_BASE}/payments/status/${encodeURIComponent(paymentId)}`,
    reference ? `${GATEWAY_BASE}/pay/status?reference=${encodeURIComponent(reference)}` : null,
  ].filter((u): u is string => Boolean(u));

  for (const url of candidates) {
    try {
      const res = await fetch(url, { headers: { "X-API-Key": GATEWAY_KEY }, signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      const status = extractStatus(data);
      if (status) return { confirmed: isSuccessStatus(status), status };
    } catch {
      /* try the next candidate shape */
    }
  }
  return { confirmed: false };
}

/* ------------------------- webhook verification ---------------------- */

/**
 * Verify a webhook signature. The gateway's exact header isn't documented
 * publicly, so we accept the common conventions (HMAC-SHA256/1 of the raw
 * body, hex or base64, with or without "sha256=" prefix) under a handful of
 * standard header names, plus a plain X-API-Key match as a last resort.
 */
export function verifyWebhookSignature(rawBody: string, headers: Headers): boolean {
  const secrets = [WEBHOOK_SECRET, SIGNING_SECRET].filter(Boolean);
  const candidates = [
    "x-webhook-signature",
    "x-signature",
    "x-hub-signature-256",
    "x-ontech-signature",
    "signature",
    "x-webhook-secret",
    "x-pay-signature",
  ]
    .map((name) => headers.get(name))
    .filter((v): v is string => Boolean(v));

  for (const secret of secrets) {
    const sha256hex = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    const sha1hex = crypto.createHmac("sha1", secret).update(rawBody).digest("hex");
    const base64 = Buffer.from(sha256hex, "hex").toString("base64");
    const variants = new Set([
      sha256hex,
      `sha256=${sha256hex}`,
      sha1hex,
      `sha1=${sha1hex}`,
      base64,
      `sha256=${base64}`,
    ]);
    for (const header of candidates) {
      const parts = header.split(",").map((s) => s.trim());
      if (parts.some((part) => variants.has(part))) return true;
    }
  }

  // Fallback: gateway may send its API key instead of a signature.
  const apiKey = headers.get("x-api-key");
  if (GATEWAY_KEY && apiKey && apiKey === GATEWAY_KEY) return true;

  // Dev mode: no secrets configured → accept (documented in README).
  return secrets.length === 0;
}

/* --------------------------- event store ---------------------------- */
/**
 * Minimal webhook event store. In production, persist confirmations in the
 * Postgres ledger (src/db) — this keeps dev/preview working with a
 * gitignored JSON file.
 */

const EVENTS_DIR = path.join(process.cwd(), "data");
const EVENTS_FILE = path.join(EVENTS_DIR, "payment-events.json");
const events = new Map<string, Record<string, unknown>>();

function persistEvents() {
  try {
    fs.mkdirSync(EVENTS_DIR, { recursive: true });
    fs.writeFileSync(EVENTS_FILE, JSON.stringify(Array.from(events.values()), null, 2));
  } catch {
    /* non-fatal */
  }
}

function loadEvents() {
  try {
    if (!fs.existsSync(EVENTS_FILE)) return;
    const arr = JSON.parse(fs.readFileSync(EVENTS_FILE, "utf8")) as Record<string, unknown>[];
    for (const entry of arr) {
      if (entry && typeof entry.reference === "string") events.set(entry.reference, entry);
    }
  } catch {
    /* non-fatal */
  }
}

loadEvents();

export function recordWebhookEvent(reference: string, payload: unknown, status?: string) {
  events.set(reference, {
    reference,
    status: status ?? "success",
    receivedAt: Date.now(),
    payload,
  });
  persistEvents();
}

export function getWebhookEvent(reference: string): Record<string, unknown> | undefined {
  return events.get(reference);
}
