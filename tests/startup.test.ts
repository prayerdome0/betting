/**
 * Reported: "Your account could not be created yet — the server rejected the
 * request. Request failed (HTTP 500)." with an EMPTY response body.
 *
 * Next.js answers an exception that escapes an App Route handler — including a
 * failure to load the handler's own module graph — with a bodiless HTTP 500.
 * Reproduced against a production build by removing the `.next/node_modules`
 * symlink Turbopack leaves for the externalized Firebase Admin SDK: every API
 * route, `/api/health` included, answered `500` with no body and the browser
 * could only say "Request failed (HTTP 500)".
 *
 * The routes now load their implementation lazily behind a startup guard so
 * that failure is answered with its reason. These tests pin the guard's
 * wording and the structural rule that makes it effective: the route files
 * must not import the Firebase server modules statically.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  describeStartupFailure,
  startupFailureHealth,
  startupFailureResponse,
} from "../src/lib/server/startup";

test("a missing server package is explained with the operator's next step", async () => {
  const error = new Error(
    "Failed to load external module firebase-admin-a14c8a5423a75469/app: Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'firebase-admin-a14c8a5423a75469' imported from /srv/.next/server/chunks/[turbopack]_runtime.js\n    at externalImport (runtime.js:687:15)",
  );
  const message = describeStartupFailure(error);
  assert.match(message, /failed to start/);
  assert.match(
    message,
    /Cannot find package 'firebase-admin-a14c8a5423a75469'/,
  );
  assert.match(message, /node_modules/);
  assert.match(message, /Nothing was read or written/);
  assert.doesNotMatch(
    message,
    /at externalImport/,
    "stack frames stay in the server log",
  );

  const response = startupFailureResponse("/api/command", error);
  assert.equal(response.status, 503);
  const body = (await response.json()) as { error: string };
  assert.equal(body.error, message);
});

test("a Node.js runtime too old for the Admin SDK's ESM dependencies is named as such", () => {
  const message = describeStartupFailure(
    Object.assign(
      new Error(
        "require() of ES Module /srv/node_modules/jose/dist/node/esm/index.js from /srv/node_modules/jwks-rsa/src/JwksClient.js not supported.",
      ),
      { code: "ERR_REQUIRE_ESM" },
    ),
  );
  assert.match(message, /Node\.js 22\.12 or newer/);
});

test("unknown failures are still bounded and never empty", () => {
  const long = "x".repeat(2000);
  const message = describeStartupFailure(new Error(long));
  assert.ok(message.length < 500);
  assert.match(describeStartupFailure(undefined), /unknown error/);
  assert.match(describeStartupFailure("plain string"), /plain string/);
});

test("/api/health still answers with a diagnosable payload when the server cannot start", () => {
  const health = startupFailureHealth(
    new Error("Cannot find module 'firebase-admin/app'"),
  );
  assert.equal(health.status, "SERVER_STARTUP_FAILED");
  assert.equal(health.configured, false);
  assert.equal(health.identitySource, null);
  assert.deepEqual(health.checks, {
    identity: false,
    database: false,
    worker: false,
    feed: false,
  });
  assert.match(health.message, /Cannot find module 'firebase-admin\/app'/);
  assert.ok(Number.isFinite(health.serverTime));
});

test("route files load the Firebase server modules lazily, so a load failure is catchable", () => {
  for (const route of [
    "src/app/api/command/route.ts",
    "src/app/api/health/route.ts",
    "src/app/api/admin/route.ts",
  ]) {
    const source = readFileSync(route, "utf8");
    const staticImports = [
      ...source.matchAll(/^import .* from "([^"]+)";/gm),
    ].map((m) => m[1]);
    for (const specifier of staticImports)
      assert.ok(
        specifier === "next/server" || specifier === "@/lib/server/startup",
        `${route} imports ${specifier} statically; only next/server and the startup guard may be loaded with the route module`,
      );
    assert.match(
      source,
      /import\("@\/lib\/server\//,
      `${route} must load its implementation with a dynamic import`,
    );
  }
  // And the guard itself must stay free of Firebase imports.
  const guard = readFileSync("src/lib/server/startup.ts", "utf8");
  for (const [, specifier] of guard.matchAll(/from "([^"]+)";/g))
    assert.ok(
      specifier === "next/server" || specifier === "../trading/status",
      `startup.ts imports ${specifier}; it must not depend on Firebase modules`,
    );
});
