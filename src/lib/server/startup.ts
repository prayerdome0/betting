import { NextResponse } from "next/server";
import type { ServiceHealth } from "../trading/status";

/**
 * Startup guard for the API routes.
 *
 * When an exception escapes an App Route handler, Next.js answers with an
 * HTTP 500 and an EMPTY body. That includes a failure to *load* the handler's
 * module graph: a server dependency that is missing from the deployment (a
 * host that dropped the `.next/node_modules` symlinks Turbopack uses for
 * externalized packages, `node_modules` pruned or reinstalled differently), or
 * a Node.js runtime too old for the Admin SDK's ESM-only dependencies. The
 * browser can only render that answer as "Request failed (HTTP 500)", and
 * `/api/health` dies the same way, so the operator is left with no diagnostics
 * at all.
 *
 * The route files therefore keep their imports light and load their
 * implementation lazily, turning a startup failure into a JSON answer that
 * names the real reason. Nothing here may import the Firebase SDKs.
 */

const REASON_HINTS: [RegExp, string][] = [
  [
    /ERR_REQUIRE_ESM|require\(\) of ES Module|Cannot use import statement|ERR_UNSUPPORTED_DIR_IMPORT/i,
    "The Node.js runtime is too old for the Firebase Admin SDK's dependencies: run Node.js 22.12 or newer.",
  ],
  [
    /Failed to load external module|Cannot find (module|package)|MODULE_NOT_FOUND/i,
    "A server package could not be loaded: confirm node_modules is installed for the runtime and that the deployment preserved the build output unchanged (Turbopack builds keep externalized packages behind symlinks in .next/node_modules; this project builds with `next build --webpack` to avoid depending on them).",
  ],
];

/** First line of the underlying error, bounded, with an operator hint. */
export function describeStartupFailure(error: unknown) {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  const reason = raw.split("\n")[0].trim().slice(0, 300) || "unknown error";
  const hint = REASON_HINTS.find(([pattern]) => pattern.test(raw))?.[1];
  return `The server code failed to start, so the request could not be handled: ${reason}.${hint ? ` ${hint}` : ""} Nothing was read or written.`;
}

/** JSON 503 for a route whose implementation could not be loaded. */
export function startupFailureResponse(route: string, error: unknown) {
  console.error(`${route} failed to start`, error);
  return NextResponse.json(
    { error: describeStartupFailure(error) },
    { status: 503 },
  );
}

/** `/api/health` payload for a server whose code could not be loaded. */
export function startupFailureHealth(error: unknown): ServiceHealth {
  return {
    configured: false,
    identitySource: null,
    identityHint: "UNKNOWN",
    workerOnline: false,
    feedFresh: false,
    heartbeatAt: null,
    marketUpdatedAt: null,
    serverTime: Date.now(),
    environment: process.env.FIRESTORE_EMULATOR_HOST
      ? "FIREBASE_EMULATOR"
      : "FIREBASE",
    status: "SERVER_STARTUP_FAILED",
    message: describeStartupFailure(error),
    checks: { identity: false, database: false, worker: false, feed: false },
  };
}
