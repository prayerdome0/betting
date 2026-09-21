import { NextResponse } from "next/server";
import { getServiceHealth } from "@/lib/server/health";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json(await getServiceHealth(), {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
