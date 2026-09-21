import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type Credential,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import type { IdentityHint, IdentitySource } from "../trading/status";
import { browserProjectId } from "../firebaseProject";

/**
 * Server-side Firebase identity.
 *
 * Every mutation in this app (including the one-time account creation that runs
 * immediately after sign-up) is executed by the Admin SDK behind
 * `verifyRequest`, because the Firestore rules deny all client writes. If the
 * server cannot obtain a credential, sign-in succeeds in the browser while the
 * account can never be created — the user is left on a dead dashboard. The
 * resolution below therefore accepts every credential shape a host can actually
 * provide:
 *
 *   1. isolated emulators (local development only, demo-* project),
 *   2. FIREBASE_SERVICE_ACCOUNT_JSON (a whole key file in one env var — the
 *      standard serverless/Vercel shape),
 *   3. FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY (+ FIREBASE_PRIVATE_KEY_ID),
 *   4. GOOGLE_APPLICATION_CREDENTIALS / workload identity (Application Default
 *      Credentials).
 *
 * Nothing here logs or returns key material; failures are reported as stable,
 * non-secret hints.
 */

export type { IdentityHint, IdentitySource };

const DEFAULT_PROJECT_ID = "ai-health-d2c5b";
const IDENTITY_PROBE_TIMEOUT_MS = 10_000;
const IDENTITY_SUCCESS_TTL_MS = 60_000;
const IDENTITY_FAILURE_TTL_MS = 5_000;

export type Identity = {
  source: IdentitySource;
  hint: IdentityHint;
  projectId: string;
  /** Operator-facing explanation. Never contains key material. */
  detail: string;
  credential: Credential | null;
};

/** Thrown when the deployment cannot act as a trusted server. */
export class IdentityError extends Error {
  constructor(
    public hint: IdentityHint,
    public source: IdentitySource | "NONE",
    message: string,
  ) {
    super(message);
    this.name = "IdentityError";
  }
}

type ServiceAccountKey = {
  type?: string;
  project_id?: string;
  private_key?: string;
  private_key_id?: string;
  client_email?: string;
};

/**
 * Platform env vars (Vercel, GitHub Actions, shell `.env` files) routinely carry
 * PEM newlines as the two literal characters `\n`. Google's JWT signer needs
 * real newlines, otherwise every token exchange fails with `invalid_grant`.
 */
export function normalizePrivateKey(key: string) {
  return key.trim().replace(/\\n/g, "\n");
}

export function configuredProjectId() {
  return (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    DEFAULT_PROJECT_ID
  );
}

function identity(
  source: IdentitySource,
  projectId: string,
  detail: string,
  credential: Credential | null,
): Identity {
  return { source, hint: "READY", projectId, detail, credential };
}

function broken(
  source: IdentitySource,
  hint: IdentityHint,
  projectId: string,
  detail: string,
): Identity {
  return { source, hint, projectId, detail, credential: null };
}

function fromServiceAccount(
  source: IdentitySource,
  key: ServiceAccountKey,
  projectId: string,
): Identity {
  const clientEmail = key.client_email?.trim();
  const privateKey = key.private_key ? normalizePrivateKey(key.private_key) : "";
  if (!clientEmail || !privateKey.includes("BEGIN"))
    return broken(
      source,
      "INCOMPLETE_SERVICE_ACCOUNT",
      projectId,
      `${source} needs both client_email and a PEM private_key.`,
    );
  const keyProject = key.project_id?.trim();
  // Compare against the project the browser actually signs users into: an
  // explicit FIREBASE_PROJECT_ID, otherwise the configured client project.
  const expectedProjectId = process.env.FIREBASE_PROJECT_ID || browserProjectId();
  if (keyProject && keyProject !== expectedProjectId)
    return broken(
      source,
      "PROJECT_MISMATCH",
      projectId,
      `The server credential belongs to Firebase project "${keyProject}" but the browser signs users into "${expectedProjectId}". ID tokens can only be verified inside the project that issued them. Set NEXT_PUBLIC_FIREBASE_PROJECT_ID (and the rest of the browser Firebase config) to "${keyProject}", or use a service account from "${expectedProjectId}".`,
    );
  const effectiveProjectId = keyProject || projectId;
  return identity(
    source,
    effectiveProjectId,
    `Service account ${clientEmail}`,
    cert({
      projectId: effectiveProjectId,
      clientEmail,
      privateKey,
      ...(key.private_key_id ? { privateKeyId: key.private_key_id } : {}),
    }),
  );
}

/** Pure function of the environment; safe to call on every request. */
export function resolveIdentity(): Identity {
  const projectId = configuredProjectId();
  const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;

  if (firestoreHost || authHost) {
    // Server-side emulator use does not require the browser flag: the documented
    // integration-test command sets only the two hosts plus a demo-* project.
    if (!projectId.startsWith("demo-") || !firestoreHost || !authHost)
      return broken(
        "EMULATOR",
        "EMULATOR_INCOMPLETE",
        projectId,
        "Auth and Firestore emulators must be configured together with a demo-* project and NEXT_PUBLIC_FIREBASE_EMULATORS=true. Mixing emulator identity and production data is forbidden.",
      );
    return identity("EMULATOR", projectId, "Local Firebase emulators", null);
  }
  if (process.env.NEXT_PUBLIC_FIREBASE_EMULATORS === "true")
    return broken(
      "EMULATOR",
      "EMULATOR_INCOMPLETE",
      projectId,
      "The emulator client requires both server emulator connections.",
    );

  const clientProjectId = browserProjectId();
  const serverProjectId = process.env.FIREBASE_PROJECT_ID;
  if (serverProjectId && serverProjectId !== clientProjectId)
    return broken(
      "APPLICATION_DEFAULT",
      "PROJECT_MISMATCH",
      projectId,
      `The server is configured for Firebase project "${serverProjectId}" while the browser signs users into "${clientProjectId}" (NEXT_PUBLIC_FIREBASE_PROJECT_ID). Browser ID tokens can never verify against the other project.`,
    );

  const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (rawKey) {
    let parsed: ServiceAccountKey;
    try {
      parsed = JSON.parse(rawKey) as ServiceAccountKey;
    } catch {
      return broken(
        "SERVICE_ACCOUNT_JSON",
        "INVALID_SERVICE_ACCOUNT_JSON",
        projectId,
        "FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON. Paste the complete service account key file contents.",
      );
    }
    return fromServiceAccount("SERVICE_ACCOUNT_JSON", parsed, projectId);
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (clientEmail || privateKey) {
    if (!clientEmail || !privateKey)
      return broken(
        "SERVICE_ACCOUNT_FIELDS",
        "INCOMPLETE_SERVICE_ACCOUNT",
        projectId,
        "FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY must be set together.",
      );
    return fromServiceAccount(
      "SERVICE_ACCOUNT_FIELDS",
      {
        client_email: clientEmail,
        private_key: privateKey,
        private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
        project_id: serverProjectId || clientProjectId,
      },
      projectId,
    );
  }

  return identity(
    "APPLICATION_DEFAULT",
    projectId,
    "Application Default Credentials / workload identity",
    applicationDefault(),
  );
}

let cachedIdentity: Identity | null = null;
let cachedSignature = "";

function signature() {
  return [
    process.env.FIRESTORE_EMULATOR_HOST,
    process.env.FIREBASE_AUTH_EMULATOR_HOST,
    process.env.NEXT_PUBLIC_FIREBASE_EMULATORS,
    process.env.FIREBASE_PROJECT_ID,
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.length,
    process.env.FIREBASE_CLIENT_EMAIL,
    process.env.FIREBASE_PRIVATE_KEY?.length,
    process.env.FIREBASE_PRIVATE_KEY_ID,
    process.env.GOOGLE_APPLICATION_CREDENTIALS,
  ].join("|");
}

/** Cached identity resolution; recomputed if the environment changes. */
export function currentIdentity(): Identity {
  const next = signature();
  if (!cachedIdentity || cachedSignature !== next) {
    cachedIdentity = resolveIdentity();
    cachedSignature = next;
  }
  return cachedIdentity;
}

/** Test/diagnostic hook: drop cached identity and probe results. */
export function resetIdentityCache() {
  cachedIdentity = null;
  cachedSignature = "";
  probe = null;
  probeFailure = null;
  probedAt = 0;
}

export function adminApp() {
  const resolved = currentIdentity();
  if (resolved.hint !== "READY")
    throw new IdentityError(resolved.hint, resolved.source, resolved.detail);
  return (
    getApps()[0] ||
    initializeApp({
      projectId: resolved.projectId,
      ...(resolved.credential ? { credential: resolved.credential } : {}),
    })
  );
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`${label} timed out after ${ms}ms`)),
        ms,
      );
    }),
  ]);
}

/**
 * Validate the credential before starting Firestore's background gRPC client.
 * Without this, missing credentials spawn repeated background retries during
 * health checks; with it, a hanging metadata service cannot consume an entire
 * serverless invocation budget.
 */
let probe: Promise<void> | null = null;
let probeFailure: IdentityError | null = null;
let probedAt = 0;

function classifyProbeFailure(error: unknown): IdentityError {
  const message = error instanceof Error ? error.message : String(error);
  const hint: IdentityHint = /default credentials|Could not load/i.test(message)
    ? "NOT_CONFIGURED"
    : "CREDENTIAL_REJECTED";
  const detail =
    hint === "NOT_CONFIGURED"
      ? "No server credential is available. Set FIREBASE_SERVICE_ACCOUNT_JSON (or FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY) on this host, or attach workload identity/Application Default Credentials."
      : `The configured server credential was rejected: ${message.slice(0, 200)}`;
  return new IdentityError(hint, currentIdentity().source, detail);
}

export async function requireServerIdentity() {
  const resolved = currentIdentity();
  if (resolved.hint !== "READY")
    throw new IdentityError(resolved.hint, resolved.source, resolved.detail);
  if (resolved.source === "EMULATOR") return;
  if (!resolved.credential)
    throw new IdentityError(
      "NOT_CONFIGURED",
      resolved.source,
      "No server credential is configured.",
    );

  const now = Date.now();
  if (probeFailure && now - probedAt < IDENTITY_FAILURE_TTL_MS)
    throw probeFailure;
  if (!probeFailure && probe && now - probedAt < IDENTITY_SUCCESS_TTL_MS)
    return probe;

  probeFailure = null;
  probedAt = now;
  probe = withTimeout(
    Promise.resolve(resolved.credential.getAccessToken()),
    IDENTITY_PROBE_TIMEOUT_MS,
    "Server Firebase credential check",
  )
    .then(() => undefined)
    .catch((error) => {
      probeFailure = classifyProbeFailure(error);
      probe = null;
      console.error("Server Firebase identity unavailable:", probeFailure.message);
      throw probeFailure;
    });
  return probe;
}

/** Non-secret diagnostics for `/api/health` and the in-app status panel. */
export function identityDiagnostics() {
  const resolved = currentIdentity();
  return { source: resolved.source, hint: resolved.hint };
}

export const db = () => getFirestore(adminApp());
export const adminAuth = () => getAuth(adminApp());

/** Operator-safe explanation of why authenticated requests cannot be served. */
export function identityFailureMessage(hint: IdentityHint) {
  switch (hint) {
    case "NOT_CONFIGURED":
      return "The server has no Firebase credential, so your account cannot be created. Set FIREBASE_SERVICE_ACCOUNT_JSON (or FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY) for this deployment, or attach Application Default Credentials.";
    case "INVALID_SERVICE_ACCOUNT_JSON":
      return "FIREBASE_SERVICE_ACCOUNT_JSON on the server is not valid JSON. Paste the full service account key file.";
    case "INCOMPLETE_SERVICE_ACCOUNT":
      return "The server credential is incomplete. Provide client_email and private_key (FIREBASE_SERVICE_ACCOUNT_JSON, or FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY).";
    case "PROJECT_MISMATCH":
      return "The server credential and the browser Firebase configuration point at different Firebase projects. Make FIREBASE_PROJECT_ID, NEXT_PUBLIC_FIREBASE_PROJECT_ID and the service account project_id agree.";
    case "CREDENTIAL_REJECTED":
      return "Google rejected the server Firebase credential. Confirm the service account still exists, belongs to this project, and has Firebase Auth + Firestore access.";
    case "EMULATOR_INCOMPLETE":
      return "Emulator mode is only half configured. Set NEXT_PUBLIC_FIREBASE_EMULATORS, FIRESTORE_EMULATOR_HOST, FIREBASE_AUTH_EMULATOR_HOST and a demo-* FIREBASE_PROJECT_ID together.";
    default:
      return "Firebase server authentication is unavailable. Check the server identity and Firebase project access.";
  }
}

export async function verifyRequest(request: Request) {
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new ApiError(401, "Please sign in to continue.");
  try {
    await requireServerIdentity();
  } catch (error) {
    // Infrastructure, not the user's sign-in: never tell them to log in again.
    if (error instanceof IdentityError)
      throw new ApiError(503, identityFailureMessage(error.hint));
    console.error("Server identity check failed", error);
    throw new ApiError(503, identityFailureMessage("CREDENTIAL_REJECTED"));
  }
  try {
    return await adminAuth().verifyIdToken(token, true);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (
      code &&
      [
        "auth/id-token-expired",
        "auth/id-token-revoked",
        "auth/user-disabled",
        "auth/user-not-found",
        "auth/argument-error",
        "auth/invalid-id-token",
        "auth/invalid-argument",
      ].includes(code)
    ) {
      throw new ApiError(
        401,
        "Your sign-in is invalid or expired. Please sign in again.",
      );
    }
    if (code === "auth/project-not-found")
      throw new ApiError(
        503,
        identityFailureMessage("PROJECT_MISMATCH"),
      );
    console.error("Server token verification unavailable", error);
    throw new ApiError(
      503,
      "Firebase server authentication is unavailable. Check server credentials, project configuration, and Firestore deployment.",
    );
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
