/**
 * Browser-less harness for the *real* client components.
 *
 * There is no browser or Firebase project available in this environment, so the
 * sign-up/sign-in path is exercised by running the actual React tree
 * (`TradingApp` -> `useAuth` -> `useTrading` -> `AuthDialog`) inside jsdom
 * against a fake Firebase Auth/Firestore transport and a programmable HTTP
 * stub for `/api/command` + `/api/health`.
 *
 * The mocks are registered at module-evaluation time (before any application
 * module is imported) with `node:test`'s `mock.module`, so the app code under
 * test is the shipped code — only the Firebase SDK boundary is faked.
 */
import { JSDOM } from "jsdom";
import { mock } from "node:test";
import { createRequire } from "node:module";
import React from "react";

export type FakeUser = {
  uid: string;
  email: string;
  getIdToken: () => Promise<string>;
  getIdTokenResult: () => Promise<{ claims: Record<string, unknown> }>;
};

/* ------------------------------------------------------------------ auth --- */

const authListeners = new Set<(user: FakeUser | null) => void>();
let currentUser: FakeUser | null = null;
/** Set to an Error to make the next sign-in/sign-up call fail. */
export let authFailure: { code?: string; message: string } | null = null;
export function setAuthFailure(failure: { code?: string; message: string } | null) {
  authFailure = failure;
}
export const authCalls: string[] = [];

function makeUser(email: string, uid = `uid-${email.replace(/\W/g, "")}`): FakeUser {
  return {
    uid,
    email,
    getIdToken: async () => `token.${uid}`,
    getIdTokenResult: async () => ({ claims: { admin: false } }),
  };
}

function setUser(user: FakeUser | null) {
  currentUser = user;
  for (const listener of [...authListeners]) listener(user);
}

export function currentUserValue() {
  return currentUser;
}

/** Restore the fake SDK to a signed-out state without notifying listeners. */
export function resetAuth() {
  currentUser = null;
  authListeners.clear();
  authCalls.length = 0;
  authFailure = null;
}

/** Pretend the browser reloaded with a persisted session already on disk. */
export function seedPersistedUser(email: string) {
  currentUser = makeUser(email);
  return currentUser;
}

export async function fakeSignUp(email: string) {
  authCalls.push(`signUp:${email}`);
  if (authFailure) throw Object.assign(new Error(authFailure.message), { code: authFailure.code });
  const user = makeUser(email);
  setUser(user);
  return { user };
}

export async function fakeSignIn(email: string) {
  authCalls.push(`signIn:${email}`);
  if (authFailure) throw Object.assign(new Error(authFailure.message), { code: authFailure.code });
  const user = makeUser(email);
  setUser(user);
  return { user };
}

export async function fakeSignOut() {
  authCalls.push("signOut");
  setUser(null);
}

/* ------------------------------------------------------------- firestore --- */

type Subscription = {
  path: string;
  isQuery: boolean;
  next: (snapshot: unknown) => void;
  error?: (failure: unknown) => void;
};

const subscriptions: Subscription[] = [];
export const firestoreSubscriptions = subscriptions;
/** path -> document data (undefined/null means "does not exist"). */
const documents = new Map<string, Record<string, unknown> | null>();
/** collection path -> array of documents. */
const collections = new Map<string, Record<string, unknown>[]>();
/** Set to an Error to make every listener fail, like denied security rules. */
export let firestoreFailure: { code?: string; message: string } | null = null;
export function setFirestoreFailure(failure: { code?: string; message: string } | null) {
  firestoreFailure = failure;
}

export function setDocument(path: string, data: Record<string, unknown> | null) {
  documents.set(path, data);
  deliver(path);
}

export function setCollection(path: string, docs: Record<string, unknown>[]) {
  collections.set(path, docs);
  deliver(path);
}

export function hasDocument(path: string) {
  return !!documents.get(path);
}

export function resetFirestoreData() {
  documents.clear();
  collections.clear();
  subscriptions.length = 0;
  firestoreFailure = null;
}

function docSnapshot(path: string, fromCache: boolean) {
  const data = documents.get(path);
  return {
    exists: () => !!data,
    data: () => data ?? undefined,
    id: path.split("/").pop(),
    metadata: { fromCache, hasPendingWrites: false },
  };
}

function querySnapshot(path: string, fromCache: boolean) {
  const docs = collections.get(path) ?? [];
  return {
    docs: docs.map((d) => ({ id: String(d.id ?? ""), data: () => d })),
    size: docs.length,
    empty: docs.length === 0,
    metadata: { fromCache, hasPendingWrites: false },
  };
}

function deliver(path: string) {
  for (const subscription of subscriptions) {
    if (subscription.path !== path) continue;
    if (firestoreFailure) {
      subscription.error?.(
        Object.assign(new Error(firestoreFailure.message), { code: firestoreFailure.code }),
      );
      continue;
    }
    subscription.next(
      subscription.isQuery ? querySnapshot(path, false) : docSnapshot(path, false),
    );
  }
}

export function failSubscriptions(failure: { code?: string; message: string }) {
  for (const subscription of [...subscriptions]) {
    subscription.error?.(Object.assign(new Error(failure.message), { code: failure.code }));
  }
}

function onSnapshot(target: { __path: string; __query?: boolean }, ...rest: unknown[]) {
  const options = (typeof rest[0] === "object" ? rest[0] : null) as never;
  const callbacks = (options ? rest.slice(1) : rest) as ((value: unknown) => void)[];
  const subscription: Subscription = {
    path: target.__path,
    isQuery: !!target.__query,
    next: callbacks[0],
    error: callbacks[1],
  };
  subscriptions.push(subscription);
  // The real SDK always delivers an initial (possibly cached) snapshot.
  queueMicrotask(() => {
    if (firestoreFailure) {
      subscription.error?.(
        Object.assign(new Error(firestoreFailure.message), { code: firestoreFailure.code }),
      );
      return;
    }
    subscription.next(
      subscription.isQuery ? querySnapshot(target.__path, true) : docSnapshot(target.__path, true),
    );
  });
  return () => {
    const index = subscriptions.indexOf(subscription);
    if (index >= 0) subscriptions.splice(index, 1);
  };
}

/* ------------------------------------------------------------------- http --- */

export type HttpResult = { status: number; body: unknown; raw?: string };
export const http = {
  /** Handler for POST /api/command. */
  command: async (body: unknown): Promise<HttpResult> => ({
    status: 200,
    body: { message: `accepted:${JSON.stringify(body)}` },
  }),
  /** Handler for GET /api/health. */
  health: async (): Promise<HttpResult> => ({
    status: 200,
    body: {
      configured: true,
      workerOnline: true,
      feedFresh: true,
      heartbeatAt: Date.now(),
      marketUpdatedAt: Date.now(),
      serverTime: Date.now(),
      environment: "FIREBASE",
      status: "READY",
      message: "Ready.",
      checks: { identity: true, database: true, worker: true, feed: true },
    },
  }),
  requests: [] as { path: string; method: string; body: unknown }[],
};

export function resetHttp() {
  http.requests.length = 0;
  http.command = async (body: unknown) => ({
    status: 200,
    body: { message: `accepted:${JSON.stringify(body)}` },
  });
  http.health = async () => ({
    status: 200,
    body: {
      configured: true,
      workerOnline: true,
      feedFresh: true,
      heartbeatAt: Date.now(),
      marketUpdatedAt: Date.now(),
      serverTime: Date.now(),
      environment: "FIREBASE",
      status: "READY",
      message: "Ready.",
      checks: { identity: true, database: true, worker: true, feed: true },
    },
  });
}

async function fakeFetch(input: unknown, init?: { method?: string; body?: string }) {
  const path = String(input);
  const method = init?.method ?? "GET";
  const body = init?.body ? JSON.parse(init.body) : undefined;
  http.requests.push({ path, method, body });
  const result = path.startsWith("/api/command")
    ? await http.command(body)
    : path.startsWith("/api/health")
      ? await http.health()
      : { status: 404, body: { error: "not found" } };
  return new Response(result.raw ?? JSON.stringify(result.body), {
    status: result.status,
    headers: { "content-type": result.raw ? "text/html" : "application/json" },
  });
}

/* ------------------------------------------------------------- jsdom setup --- */

/**
 * jsdom is created exactly once, before React DOM is imported. React caches
 * realm internals at module evaluation time, so swapping the window between
 * tests silently detaches the event system.
 */
const dom = new JSDOM(`<!doctype html><html><body></body></html>`, {
  url: "https://nexus.example/",
  pretendToBeVisual: true,
});

const win = dom.window as unknown as Record<string, unknown> & typeof globalThis;

function define(name: string, value: unknown) {
  Object.defineProperty(globalThis, name, { value, writable: true, configurable: true });
}
define("window", win);
define("document", win.document);
define("navigator", win.navigator);
define("location", win.location);
define("localStorage", win.localStorage);
define("sessionStorage", win.sessionStorage);
define("HTMLElement", win.HTMLElement);
define("HTMLInputElement", win.HTMLInputElement);
define("HTMLButtonElement", win.HTMLButtonElement);
define("Element", win.Element);
define("Node", win.Node);
define("Event", win.Event);
define("CustomEvent", win.CustomEvent);
define("KeyboardEvent", win.KeyboardEvent);
define("MouseEvent", win.MouseEvent);
define("getComputedStyle", win.getComputedStyle);
define("requestAnimationFrame", win.requestAnimationFrame);
define("cancelAnimationFrame", win.cancelAnimationFrame);
define("fetch", fakeFetch);
win.fetch = fakeFetch as typeof win.fetch;
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement | null = null;

/** Fresh mount node + cleared storage for each test case. */
export function installDom() {
  win.document.body.innerHTML = "";
  win.document.body.style.overflow = "";
  win.localStorage.clear();
  container = win.document.createElement("div");
  container.id = "root";
  win.document.body.appendChild(container);
  return win;
}

export function rootElement() {
  if (!container) installDom();
  return container!;
}

export function textContent() {
  return win.document.body.textContent ?? "";
}

export function domWindow() {
  return win;
}

/* ----------------------------------------------------------- mock registry --- */

/**
 * `tsx` compiles the app's `.ts`/`.tsx` files to CommonJS (the package is not
 * `"type": "module"`), so `require("firebase/auth")` resolves to the package's
 * CJS entry while `import("firebase/auth")` resolves to its ESM entry. Both
 * specifiers must be registered or the application code silently loads the real
 * SDK.
 */
const cjsRequire = createRequire("/home/user/betting/package.json");
function mockModule(
  specifier: string,
  options: { namedExports?: Record<string, unknown>; defaultExport?: unknown },
) {
  mock.module(specifier, options);
  try {
    mock.module(cjsRequire.resolve(specifier), options);
  } catch {
    /* No CJS entry for this package. */
  }
}

mockModule("firebase/app", {
  namedExports: {
    getApps: () => [],
    getApp: () => ({ name: "[DEFAULT]", options: {} }),
    initializeApp: (options: unknown) => ({ name: "[DEFAULT]", options }),
  },
  defaultExport: {},
});

mockModule("firebase/auth", {
  namedExports: {
    browserLocalPersistence: { type: "LOCAL" },
    getAuth: () => ({ name: "fake-auth", currentUser }),
    connectAuthEmulator: () => {},
    setPersistence: async () => {},
    onAuthStateChanged: (_auth: unknown, next: (user: FakeUser | null) => void) => {
      authListeners.add(next);
      queueMicrotask(() => next(currentUser));
      return () => authListeners.delete(next);
    },
    createUserWithEmailAndPassword: (_auth: unknown, email: string) => fakeSignUp(email),
    signInWithEmailAndPassword: (_auth: unknown, email: string) => fakeSignIn(email),
    signOut: () => fakeSignOut(),
    sendPasswordResetEmail: async () => {},
  },
  defaultExport: {},
});

mockModule("firebase/firestore", {
  namedExports: {
    getFirestore: () => ({ name: "fake-firestore" }),
    initializeFirestore: () => ({ name: "fake-firestore" }),
    doc: (_db: unknown, path: string) => ({ __path: path }),
    collection: (_db: unknown, path: string) => ({ __path: path, __query: true }),
    query: (target: { __path: string; __query?: boolean }) => ({ ...target, __query: true }),
    where: () => ({}),
    orderBy: () => ({}),
    limit: () => ({}),
    onSnapshot,
  },
  defaultExport: {},
});

mockModule("next/link", {
  defaultExport: function FakeLink(props: {
    href: string;
    className?: string;
    children?: React.ReactNode;
    "aria-label"?: string;
  }) {
    return React.createElement(
      "a",
      { href: props.href, className: props.className, "aria-label": props["aria-label"] },
      props.children,
    );
  },
});
