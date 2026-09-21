import { NextResponse } from "next/server";
import { startupFailureHealth } from "@/lib/server/startup";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, max-age=0" };
/**
 * Loaded lazily for the same reason as `/api/command`: this is the endpoint an
 * operator (and the in-app System connection panel) consults when accounts
 * cannot be created, so it must still answer — with the reason — when the
 * server's Firebase modules themselves cannot be loaded on this host.
 */
export async function GET() {
  let health: typeof import("@/lib/server/health");
  try {
    health = await import("@/lib/server/health");
  } catch (error) {
    console.error("/api/health failed to start", error);
    return NextResponse.json(startupFailureHealth(error), {
      status: 503,
      headers,
    });
  }
  return NextResponse.json(await health.getServiceHealth(), { headers });
}
