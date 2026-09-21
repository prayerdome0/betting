export type ServiceHealth = {
  configured: boolean;
  workerOnline: boolean;
  feedFresh: boolean;
  heartbeatAt: number | null;
  marketUpdatedAt: number | null;
  serverTime: number;
  environment: "FIREBASE" | "FIREBASE_EMULATOR";
  status:
    | "READY"
    | "DEGRADED"
    | "SERVER_IDENTITY_REQUIRED"
    | "DATABASE_UNAVAILABLE"
    | "WORKER_OFFLINE"
    | "FEED_STALE";
  message: string;
  checks: {
    identity: boolean;
    database: boolean;
    worker: boolean;
    feed: boolean;
  };
};
export function connectionLabel(input: {
  online: boolean;
  fromCache: boolean;
  accountExists: boolean;
  failed: boolean;
}) {
  if (!input.online) return "Offline · showing last received data";
  if (input.failed) return "Firestore connection error";
  if (input.fromCache)
    return input.accountExists
      ? "Reconnecting · cached account data"
      : "Connecting to Firestore…";
  return input.accountExists
    ? "Firestore connected"
    : "Waiting for account initialization";
}
