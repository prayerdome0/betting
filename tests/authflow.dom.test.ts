/**
 * End-to-end client flow for authentication: register -> dashboard, sign in ->
 * dashboard, refresh with a persisted session, sign out -> sign in again, and
 * the failure path when the server cannot initialize the account.
 *
 * Runs the shipped React components in jsdom (see tests/support/dom-flow.ts).
 */
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import {
  currentUserValue,
  failSubscriptions,
  hasDocument,
  http,
  installDom,
  resetAuth,
  resetFirestoreData,
  resetHttp,
  rootElement,
  seedPersistedUser,
  setCollection,
  setDocument,
  textContent,
} from "./support/dom-flow";
import { accountPath } from "../src/lib/trading/paths";

const EMAIL = "trader@example.test";
const UID = `uid-${EMAIL.replace(/\W/g, "")}`;
const ACCOUNT = accountPath(UID);

function accountFixture(email = EMAIL, uid = UID, balanceCents = 1000) {
  const now = Date.now();
  return {
    uid,
    email,
    name: email.split("@")[0],
    currency: "USD",
    accountType: "SIMULATION",
    status: "ACTIVE",
    balanceCents,
    ledgerSequence: 1,
    activitySequence: 1,
    startingBalanceCents: balanceCents,
    reservedCents: 0,
    withdrawalHoldCents: 0,
    totalPnlCents: 0,
    todayPnlCents: 0,
    pnlDay: new Date(now).toISOString().slice(0, 10),
    trades: 0,
    wins: 0,
    losses: 0,
    settings: {
      strategy: "MOMENTUM",
      markets: ["EUR/USD", "GBP/USD", "XAU/USD", "BTC/USD"],
      tradeAmountCents: 200,
      maxPositions: 2,
      stopLossPct: 0.5,
      takeProfitPct: 0.8,
      maxHoldSeconds: 120,
      maxSessionLossPct: 10,
    },
    activeSessionId: null,
    createdAt: now,
    updatedAt: now,
  };
}

/** Server that creates the Firestore account when the client initializes it. */
function healthyBackend() {
  http.command = async (body: unknown) => {
    const action = (body as { action?: string })?.action;
    if (action === "initialize") {
      // Like the real server: initialization is idempotent and never overwrites
      // an account that already exists.
      if (hasDocument(ACCOUNT))
        return { status: 200, body: { message: "Account is ready." } };
      setDocument(ACCOUNT, accountFixture());
      setCollection(`${ACCOUNT}/ledger`, [
        {
          id: "l1",
          sequence: 1,
          type: "WELCOME_CREDIT",
          deltaCents: 1000,
          balanceAfterCents: 1000,
          referenceId: "welcome",
          timestamp: Date.now(),
          userId: UID,
        },
      ]);
      setCollection(`${ACCOUNT}/activity`, [
        {
          id: "a1",
          sequence: 1,
          userId: UID,
          sessionId: null,
          timestamp: Date.now(),
          kind: "ACCOUNT_CREATED",
          message: "Account created.",
        },
      ]);
      return { status: 200, body: { message: "Welcome. Your simulated account is ready." } };
    }
    return { status: 200, body: { message: "ok" } };
  };
}

let root: { render: (node: React.ReactNode) => void; unmount: () => void } | null = null;
let act: (fn: () => unknown | Promise<unknown>) => Promise<void>;
let TradingApp: React.ComponentType;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function mount() {
  const [{ createRoot }, app] = await Promise.all([
    import("react-dom/client"),
    import("@/components/TradingApp"),
  ]);
  TradingApp = app.default;
  root = createRoot(rootElement()) as unknown as typeof root;
  await act(async () => {
    root!.render(React.createElement(TradingApp));
    await wait(20);
  });
  await act(async () => wait(20));
}

function query(selector: string) {
  return [...(globalThis as any).document.querySelectorAll(selector)] as HTMLElement[];
}

function buttonByName(name: string, scope: ParentNode | null = null) {
  const needle = name.toLowerCase();
  const scopeText = () => (scope ? scope.textContent ?? "" : textContent());
  const candidates = [...((scope ?? (globalThis as any).document).querySelectorAll("button"))] as HTMLElement[];
  const match =
    candidates.find((element) => (element.textContent ?? "").trim().toLowerCase() === needle) ??
    candidates.find((element) => (element.textContent ?? "").toLowerCase().includes(needle));
  if (!match)
    throw new Error(
      `No button matching "${name}" in <${scope ? "dialog" : "page"}>. Text: ${scopeText().slice(0, 400)}`,
    );
  return match;
}

function dialog() {
  const element = (globalThis as any).document.querySelector('[role="dialog"]') as HTMLElement | null;
  if (!element) throw new Error(`Dialog is not open. Page text: ${textContent().slice(0, 400)}`);
  return element;
}

function dialogButton(name: string) {
  return buttonByName(name, dialog());
}

function dialogInput(label: string) {
  const field = [...dialog().querySelectorAll("label")].find((element) =>
    (element.textContent ?? "").trim().startsWith(label),
  ) as HTMLElement | undefined;
  const input = field?.querySelector("input");
  if (!input) throw new Error(`No input for label "${label}" inside the dialog`);
  return input as HTMLInputElement;
}

function click(element: HTMLElement) {
  return act(async () => {
    element.dispatchEvent(new (globalThis as any).MouseEvent("click", { bubbles: true }));
    await wait(10);
  });
}

function typeInto(element: HTMLInputElement, value: string) {
  const window = (globalThis as any).window;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;
  return act(async () => {
    setter.call(element, value);
    element.dispatchEvent(new window.Event("input", { bubbles: true }));
    await wait(5);
  });
}

beforeEach(async () => {
  installDom();
  resetAuth();
  resetFirestoreData();
  resetHttp();
  healthyBackend();
  const react = await import("react");
  act = react.act as unknown as typeof act;
});

afterEach(async () => {
  if (root) {
    await act(async () => root!.unmount());
    root = null;
  }
});

test("guest workspace renders", async () => {
  await mount();
  const text = textContent();
  assert.match(text, /Trading overview/);
  assert.match(text, /Open simulation account/);
  assert.equal(currentUserValue(), null);
});

test("registration creates the account and lands on the dashboard", async () => {
  await mount();
  await click(buttonByName("Open simulation account"));
  await typeInto(dialogInput("Email address"), EMAIL);
  await typeInto(dialogInput("Password"), "SimulatedPass123!");
  await click(dialogButton("Create simulation account"));
  await act(async () => wait(60));

  assert.equal(currentUserValue()?.email, EMAIL, "Firebase Auth signed the user in");
  const text = textContent();
  assert.match(text, /\$10\.00/, `dashboard shows the initialized balance:\n${text.slice(0, 600)}`);
  assert.doesNotMatch(text, /Connecting your persistent account/);
  assert.doesNotMatch(text, /Your account is connecting/);
  assert.ok(
    http.requests.some((r) => r.path === "/api/command" && (r.body as any)?.action === "initialize"),
    "the client initialized the server-side account",
  );
  assert.doesNotMatch(text, /Firebase server authentication is unavailable/);
});

test("existing user can sign in and reach the dashboard", async () => {
  await mount();
  await click(buttonByName("Open simulation account"));
  await click(dialogButton("Sign in"));
  await typeInto(dialogInput("Email address"), EMAIL);
  await typeInto(dialogInput("Password"), "SimulatedPass123!");
  await click(dialogButton("Sign in to your account"));
  await act(async () => wait(60));

  assert.equal(currentUserValue()?.email, EMAIL);
  assert.match(textContent(), /\$10\.00/);
});

test("a persisted session restores the dashboard on reload", async () => {
  seedPersistedUser(EMAIL);
  setDocument(ACCOUNT, accountFixture(EMAIL, UID, 50000));
  await mount();
  await act(async () => wait(60));
  assert.match(textContent(), /\$500\.00/, "refresh after login restores the account");
});

test("signing out returns to the guest workspace and signing in again works", async () => {
  seedPersistedUser(EMAIL);
  setDocument(ACCOUNT, accountFixture());
  await mount();
  await act(async () => wait(40));
  assert.match(textContent(), /\$10\.00/);

  await click(buttonByName("Settings"));
  await click(buttonByName("Sign out"));
  await act(async () => wait(40));
  assert.equal(currentUserValue(), null);
  assert.match(textContent(), /Open simulation account/);

  await click(buttonByName("Open simulation account"));
  await click(dialogButton("Sign in"));
  await typeInto(dialogInput("Email address"), EMAIL);
  await typeInto(dialogInput("Password"), "SimulatedPass123!");
  await click(dialogButton("Sign in to your account"));
  await act(async () => wait(60));
  assert.match(textContent(), /\$10\.00/, "re-login restores the dashboard");
});

test("auth failure is reported in the dialog without breaking the page", async () => {
  const { setAuthFailure } = await import("./support/dom-flow");
  await mount();
  await click(buttonByName("Open simulation account"));
  setAuthFailure({ code: "auth/email-already-in-use", message: "EMAIL_EXISTS" });
  await typeInto(dialogInput("Email address"), EMAIL);
  await typeInto(dialogInput("Password"), "SimulatedPass123!");
  await click(dialogButton("Create simulation account"));
  await act(async () => wait(40));
  setAuthFailure(null);
  assert.match(textContent(), /This email already has an account/);
  assert.match(textContent(), /Trading overview/, "the workspace is still rendered underneath");
});

test("denied Firestore reads surface an error but keep the workspace usable", async () => {
  seedPersistedUser(EMAIL);
  await mount();
  await act(async () => wait(30));
  failSubscriptions({ code: "permission-denied", message: "Missing or insufficient permissions." });
  await act(async () => wait(40));
  const text = textContent();
  assert.match(text, /Firestore/i);
  assert.match(text, /Trading overview/, "no blank page after a Firestore failure");
});

test("a server without a Firebase identity does not strand the new user", async () => {
  // This is what a deployment without a server credential looks like: Firebase
  // Auth succeeds in the browser, /api/command answers 503.
  let failures = 1;
  const realCommand = http.command;
  http.command = async (body: unknown) => {
    if ((body as { action?: string })?.action === "initialize" && failures > 0) {
      failures -= 1;
      return {
        status: 503,
        body: {
          error:
            "The server has no Firebase credential, so your account cannot be created. Set FIREBASE_SERVICE_ACCOUNT_JSON for this deployment.",
        },
      };
    }
    return realCommand(body);
  };

  await mount();
  await click(buttonByName("Open simulation account"));
  await typeInto(dialogInput("Email address"), EMAIL);
  await typeInto(dialogInput("Password"), "SimulatedPass123!");
  await click(dialogButton("Create simulation account"));
  await act(async () => wait(60));

  const text = textContent();
  assert.match(text, /Trading overview/, "the workspace keeps rendering");
  assert.match(text, /no Firebase credential/, "the real reason is displayed");
  assert.match(text, /Connecting your persistent account/);
  assert.doesNotMatch(text, /\[object Object\]/);
  assert.doesNotMatch(text, /Unexpected token/);

  // Bounded backoff: the account is created as soon as the server recovers.
  await act(async () => wait(3000));
  assert.equal(currentUserValue()?.email, EMAIL, "still signed in");
  assert.match(textContent(), /\$10\.00/, "the retry finished account creation");
  assert.doesNotMatch(textContent(), /Connecting your persistent account/);
});

test("the manual retry button initializes the account", async () => {
  let blocked = true;
  const realCommand = http.command;
  http.command = async (body: unknown) =>
    blocked && (body as { action?: string })?.action === "initialize"
      ? { status: 503, body: { error: "Server identity unavailable." } }
      : realCommand(body);

  await mount();
  await click(buttonByName("Open simulation account"));
  await typeInto(dialogInput("Email address"), EMAIL);
  await typeInto(dialogInput("Password"), "SimulatedPass123!");
  await click(dialogButton("Create simulation account"));
  await act(async () => wait(60));
  assert.match(textContent(), /Retry connection/);

  blocked = false;
  await click(buttonByName("Retry connection"));
  await act(async () => wait(60));
  assert.match(textContent(), /\$10\.00/);
});

test("platform HTML error pages are reported readably", async () => {
  http.command = async () => ({
    status: 504,
    body: null,
    raw: "<!doctype html><html><body>FUNCTION_INVOCATION_TIMEOUT</body></html>",
  });

  await mount();
  await click(buttonByName("Open simulation account"));
  await typeInto(dialogInput("Email address"), EMAIL);
  await typeInto(dialogInput("Password"), "SimulatedPass123!");
  await click(dialogButton("Create simulation account"));
  await act(async () => wait(60));

  const text = textContent();
  assert.match(text, /FUNCTION_INVOCATION_TIMEOUT/);
  assert.doesNotMatch(text, /Unexpected token/);
  assert.doesNotMatch(text, /\[object Object\]/);
  assert.match(text, /Trading overview/, "the workspace keeps rendering");
});

test("a bodiless HTTP 500 is described as a server fault with a pointer to the reason", async () => {
  // Reported: "Your account could not be created yet — the server rejected the
  // request. Request failed (HTTP 500)." This is what Next.js sends when the
  // route's own module graph fails to load: status 500, no body at all.
  http.command = async () => ({ status: 500, body: null, raw: "" });

  await mount();
  await click(buttonByName("Open simulation account"));
  await typeInto(dialogInput("Email address"), EMAIL);
  await typeInto(dialogInput("Password"), "SimulatedPass123!");
  await click(dialogButton("Create simulation account"));
  await act(async () => wait(60));

  const text = textContent();
  assert.match(text, /could not be created yet/);
  assert.match(text, /failed before it could answer \(HTTP 500\)/);
  assert.match(text, /\/api\/health/, "the operator is told where to look");
  assert.doesNotMatch(text, /rejected the request/, "a crash is not a refusal");
  assert.doesNotMatch(text, /Request failed \(HTTP 500\)\./);
  assert.match(text, /Trading overview/, "the workspace keeps rendering");
});

test("Vercel-style object error bodies are reported readably", async () => {
  http.command = async () => ({
    status: 500,
    body: { error: { code: 500, message: "FUNCTION_INVOCATION_FAILED" } },
  });

  await mount();
  await click(buttonByName("Open simulation account"));
  await typeInto(dialogInput("Email address"), EMAIL);
  await typeInto(dialogInput("Password"), "SimulatedPass123!");
  await click(dialogButton("Create simulation account"));
  await act(async () => wait(60));

  const text = textContent();
  assert.match(text, /FUNCTION_INVOCATION_FAILED/);
  assert.doesNotMatch(text, /\[object Object\]/);
});
