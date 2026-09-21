import { db, requireServerIdentity } from "./firebase";
import { heartbeatFresh } from "./invariants";
import type { ServiceHealth } from "../trading/status";
// Public diagnostics contain readiness booleans, never credentials, raw errors,
// user records, deployment identity names, or system event contents.
export async function getServiceHealth(): Promise<ServiceHealth> {
  const result: ServiceHealth = {
    configured: false,
    workerOnline: false,
    feedFresh: false,
    heartbeatAt: null,
    marketUpdatedAt: null,
    serverTime: Date.now(),
    environment: process.env.FIRESTORE_EMULATOR_HOST
      ? "FIREBASE_EMULATOR"
      : "FIREBASE",
    status: "SERVER_IDENTITY_REQUIRED",
    message:
      "Server Firebase access is not ready. Configure Application Default Credentials or a complete, isolated emulator environment.",
    checks: { identity: false, database: false, worker: false, feed: false },
  };
  try {
    await requireServerIdentity();
    result.checks.identity = true;
  } catch {
    result.serverTime = Date.now();
    return result;
  }
  try {
    const [worker, market] = await Promise.all([
      db().doc("system/worker").get(),
      db().doc("system/market").get(),
    ]);
    const now = Date.now();
    result.serverTime = now;
    result.configured = true;
    result.checks.database = true;
    const heartbeat = worker.data()?.heartbeatAt,
      quoteTime = market.data()?.updatedAt;
    result.heartbeatAt =
      typeof heartbeat === "number" && Number.isFinite(heartbeat)
        ? heartbeat
        : null;
    result.marketUpdatedAt =
      typeof quoteTime === "number" && Number.isFinite(quoteTime)
        ? quoteTime
        : null;
    result.workerOnline = result.checks.worker = heartbeatFresh(heartbeat, now);
    result.feedFresh = result.checks.feed =
      typeof quoteTime === "number" &&
      Number.isFinite(quoteTime) &&
      quoteTime <= now + 5000 &&
      now - quoteTime <= 15000;
    result.status = !result.workerOnline
      ? "WORKER_OFFLINE"
      : !result.feedFresh
        ? "FEED_STALE"
        : worker.data()?.sessionErrors > 0
          ? "DEGRADED"
          : "READY";
    result.message = {
      WORKER_OFFLINE:
        "Firestore is reachable, but the independent worker is offline. Start or restore the worker; browser timers do not execute trades.",
      FEED_STALE:
        "The market feed is stale. Trade execution is blocked until valid fresh quotes return.",
      DEGRADED:
        "The worker is online, but one or more sessions reported errors. Check your current session and admin system events.",
      READY:
        "Firebase and the independent simulation worker are connected. Prices and funds remain simulated.",
    }[result.status];
  } catch {
    result.status = "DATABASE_UNAVAILABLE";
    result.message =
      "The server identity is available, but Firestore could not be reached. Check database creation, IAM access, and network configuration.";
    result.serverTime = Date.now();
  }
  return result;
}
