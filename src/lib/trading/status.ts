/** Where the server got (or failed to get) its Firebase identity. */
export type IdentitySource =
  | "EMULATOR"
  | "SERVICE_ACCOUNT_JSON"
  | "SERVICE_ACCOUNT_FIELDS"
  | "APPLICATION_DEFAULT";

/** Non-secret reason the server identity is or is not usable. */
export type IdentityHint =
  | "READY"
  /** The server code did not start, so its identity could not be inspected. */
  | "UNKNOWN"
  | "NOT_CONFIGURED"
  | "INVALID_SERVICE_ACCOUNT_JSON"
  | "INCOMPLETE_SERVICE_ACCOUNT"
  | "PROJECT_MISMATCH"
  | "CREDENTIAL_REJECTED"
  | "EMULATOR_INCOMPLETE";

export const IDENTITY_SOURCE_LABEL: Record<IdentitySource, string> = {
  EMULATOR: "Local Firebase emulators",
  SERVICE_ACCOUNT_JSON: "FIREBASE_SERVICE_ACCOUNT_JSON",
  SERVICE_ACCOUNT_FIELDS: "FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY",
  APPLICATION_DEFAULT: "Application Default Credentials",
};

export type ServiceHealth = {
  configured: boolean;
  /** `null` only when the server code failed to start (`SERVER_STARTUP_FAILED`). */
  identitySource: IdentitySource | null;
  identityHint: IdentityHint;
  workerOnline: boolean;
  feedFresh: boolean;
  heartbeatAt: number | null;
  marketUpdatedAt: number | null;
  serverTime: number;
  environment: "FIREBASE" | "FIREBASE_EMULATOR";
  status:
    | "READY"
    | "DEGRADED"
    /** A server module could not be loaded; see `message` for the reason. */
    | "SERVER_STARTUP_FAILED"
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
