import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import {
  ApiError,
  identityDiagnostics,
  identityFailureMessage,
  normalizePrivateKey,
  requireServerIdentity,
  resetIdentityCache,
  resolveIdentity,
  verifyRequest,
} from "../src/lib/server/firebase";

const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

const PROJECT = "demo-nexus-test";
const CLIENT_EMAIL = `firebase-adminsdk-test@${PROJECT}.iam.gserviceaccount.com`;

function serviceAccountJson(project = PROJECT) {
  return JSON.stringify({
    type: "service_account",
    project_id: project,
    private_key_id: "keyid",
    private_key: privateKey,
    client_email: CLIENT_EMAIL,
  });
}

/** A coherent deployment: browser and server point at the same project. */
function useProject(project = PROJECT) {
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = project;
  process.env.FIREBASE_PROJECT_ID = project;
}

const ENV_KEYS = [
  "FIRESTORE_EMULATOR_HOST",
  "FIREBASE_AUTH_EMULATOR_HOST",
  "NEXT_PUBLIC_FIREBASE_EMULATORS",
  "FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "FIREBASE_SERVICE_ACCOUNT_JSON",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
  "FIREBASE_PRIVATE_KEY_ID",
  "GOOGLE_APPLICATION_CREDENTIALS",
];

let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = {};
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
  resetIdentityCache();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  resetIdentityCache();
});

test("a whole service account key in one env var is accepted (serverless shape)", () => {
  useProject();
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON = serviceAccountJson();
  const resolved = resolveIdentity();
  assert.equal(resolved.hint, "READY");
  assert.equal(resolved.source, "SERVICE_ACCOUNT_JSON");
  assert.equal(resolved.projectId, PROJECT);
  assert.ok(resolved.credential, "a usable Admin credential was built");
  assert.doesNotMatch(resolved.detail, /BEGIN PRIVATE KEY/);
});

test("PEM newlines stored as literal \\n are normalized (Vercel env vars)", () => {
  useProject();
  assert.equal(
    normalizePrivateKey("-----BEGIN PRIVATE KEY-----\\nABC\\n-----END PRIVATE KEY-----\\n"),
    "-----BEGIN PRIVATE KEY-----\nABC\n-----END PRIVATE KEY-----\n",
  );
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON = JSON.stringify({
    type: "service_account",
    project_id: PROJECT,
    private_key: privateKey.replace(/\n/g, "\\n"),
    client_email: CLIENT_EMAIL,
  });
  const resolved = resolveIdentity();
  assert.equal(resolved.hint, "READY", resolved.detail);
  assert.equal(resolved.source, "SERVICE_ACCOUNT_JSON");
});

test("split credential fields are accepted, and half of them is rejected", () => {
  process.env.FIREBASE_CLIENT_EMAIL = CLIENT_EMAIL;
  process.env.FIREBASE_PRIVATE_KEY = privateKey;
  useProject();
  let resolved = resolveIdentity();
  assert.equal(resolved.hint, "READY");
  assert.equal(resolved.source, "SERVICE_ACCOUNT_FIELDS");
  assert.equal(resolved.projectId, PROJECT);

  delete process.env.FIREBASE_PRIVATE_KEY;
  resetIdentityCache();
  resolved = resolveIdentity();
  assert.equal(resolved.hint, "INCOMPLETE_SERVICE_ACCOUNT");
  assert.equal(resolved.credential, null);
});

test("malformed credential JSON is reported instead of crashing", () => {
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON = "{not json";
  const resolved = resolveIdentity();
  assert.equal(resolved.hint, "INVALID_SERVICE_ACCOUNT_JSON");
  assert.match(identityFailureMessage(resolved.hint), /valid JSON/);
});

test("a credential from another project is rejected before it can 503 every user", () => {
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON = serviceAccountJson("other-project");
  useProject();
  const resolved = resolveIdentity();
  assert.equal(resolved.hint, "PROJECT_MISMATCH");
  assert.match(resolved.detail, /other-project/);
  assert.ok(resolved.detail.includes(PROJECT), resolved.detail);
});

test("a credential is checked against the project the browser signs into", () => {
  // No project env vars at all: the browser bundle uses its built-in default,
  // so a key for any other project would never verify a single ID token.
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON = serviceAccountJson("some-other-project");
  const resolved = resolveIdentity();
  assert.equal(resolved.hint, "PROJECT_MISMATCH");
  assert.match(resolved.detail, /some-other-project/);
  assert.match(resolved.detail, /NEXT_PUBLIC_FIREBASE_PROJECT_ID/);
  assert.equal(resolved.credential, null);

  // The same key becomes valid once the browser config follows it.
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "some-other-project";
  resetIdentityCache();
  const aligned = resolveIdentity();
  assert.equal(aligned.hint, "READY", aligned.detail);
  assert.equal(aligned.projectId, "some-other-project");
});

test("browser and server project ids must agree", () => {
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "browser-project";
  process.env.FIREBASE_PROJECT_ID = "server-project";
  const resolved = resolveIdentity();
  assert.equal(resolved.hint, "PROJECT_MISMATCH");
  assert.match(identityFailureMessage(resolved.hint), /different Firebase projects/);
});

test("emulators require a complete, isolated configuration", () => {
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
  process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
  process.env.FIREBASE_PROJECT_ID = "demo-nexus";
  let resolved = resolveIdentity();
  assert.equal(resolved.hint, "READY", "the documented integration-test setup");
  assert.equal(resolved.source, "EMULATOR");
  assert.equal(resolved.credential, null);

  process.env.NEXT_PUBLIC_FIREBASE_EMULATORS = "true";
  resetIdentityCache();
  resolved = resolveIdentity();
  assert.equal(resolved.hint, "READY", "the full local emulator setup");

  process.env.FIREBASE_PROJECT_ID = "ai-health-d2c5b";
  resetIdentityCache();
  resolved = resolveIdentity();
  assert.equal(resolved.hint, "EMULATOR_INCOMPLETE");

  delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
  process.env.FIREBASE_PROJECT_ID = "demo-nexus";
  resetIdentityCache();
  assert.equal(resolveIdentity().hint, "EMULATOR_INCOMPLETE");
});

test("without any credential the server says so precisely, and never blames the user", async () => {
  assert.equal(resolveIdentity().source, "APPLICATION_DEFAULT");
  assert.deepEqual(identityDiagnostics(), {
    source: "APPLICATION_DEFAULT",
    hint: "READY",
  });

  await assert.rejects(
    requireServerIdentity(),
    (error: Error & { hint?: string }) => {
      assert.equal(error.hint, "NOT_CONFIGURED");
      assert.match(error.message, /FIREBASE_SERVICE_ACCOUNT_JSON/);
      assert.doesNotMatch(error.message, /BEGIN PRIVATE KEY/);
      return true;
    },
  );

  // The user's sign-in is fine: this must be a 503 about the server, not a 401
  // telling them to log in again (which is what stranded new accounts before).
  await assert.rejects(
    verifyRequest(
      new Request("http://localhost/api/command", {
        headers: { authorization: "Bearer a.valid.token" },
      }),
    ),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 503);
      assert.match(error.message, /server has no Firebase credential/);
      assert.doesNotMatch(error.message, /sign in again/i);
      return true;
    },
  );
});

test("a missing token is still a 401", async () => {
  await assert.rejects(
    verifyRequest(new Request("http://localhost/api/command")),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.status, 401);
      return true;
    },
  );
});

test("failure messages are actionable and never leak secrets", () => {
  for (const hint of [
    "NOT_CONFIGURED",
    "INVALID_SERVICE_ACCOUNT_JSON",
    "INCOMPLETE_SERVICE_ACCOUNT",
    "PROJECT_MISMATCH",
    "CREDENTIAL_REJECTED",
    "EMULATOR_INCOMPLETE",
  ] as const) {
    const message = identityFailureMessage(hint);
    assert.ok(message.length > 20, hint);
    assert.doesNotMatch(message, /BEGIN PRIVATE KEY/);
    assert.doesNotMatch(message, /iam\.gserviceaccount\.com/);
  }
});

test("idempotency keys are generated outside secure contexts too", async () => {
  const { commandKey } = await import("../src/lib/useTrading");
  const secure = commandKey();
  assert.match(secure, /^[a-zA-Z0-9-]{8,80}$/, "accepted by the server validator");

  // Plain-HTTP origins (LAN previews, containers, some mobile browsers) expose
  // no crypto.randomUUID; the fallback must still produce a valid key.
  const realCrypto = globalThis.crypto;
  const bytes = new Uint8Array(16);
  Object.defineProperty(globalThis, "crypto", {
    value: {
      getRandomValues: (target: Uint8Array) => {
        realCrypto.getRandomValues(bytes);
        target.set(bytes);
        return target;
      },
    },
    configurable: true,
    writable: true,
  });
  try {
    const insecure = commandKey();
    assert.match(insecure, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  } finally {
    Object.defineProperty(globalThis, "crypto", {
      value: realCrypto,
      configurable: true,
      writable: true,
    });
  }
});
