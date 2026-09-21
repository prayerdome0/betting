import { startupFailureResponse } from "@/lib/server/startup";
export const runtime = "nodejs";
// The first authenticated request after a sign-up pays the Admin SDK cold start
// (gRPC channel + token exchange) inside a Firestore transaction. The default
// serverless budget is not enough for that on a fresh instance.
export const maxDuration = 30;
/**
 * The implementation (and with it the Firebase Admin SDK) is loaded on the
 * first request rather than with this module: an exception that escapes a
 * route handler — a dependency the deployment cannot load included — becomes
 * a bodiless HTTP 500 in Next.js, which the browser can only report as
 * "Request failed (HTTP 500)". Loading lazily lets that failure be answered
 * with its reason instead.
 */
export async function POST(request: Request) {
  let service: typeof import("@/lib/server/command-service");
  try {
    service = await import("@/lib/server/command-service");
  } catch (error) {
    return startupFailureResponse("/api/command", error);
  }
  return service.handleCommand(request);
}
