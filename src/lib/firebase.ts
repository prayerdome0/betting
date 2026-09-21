import { getApps, getApp, initializeApp } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  setPersistence,
  browserLocalPersistence,
  type Auth,
} from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  type Firestore,
} from "firebase/firestore";

import { browserProjectId } from "./firebaseProject";

export const isEmulator = process.env.NEXT_PUBLIC_FIREBASE_EMULATORS === "true";

/**
 * Every field is overridable so a deployment can point the browser at its own
 * Firebase project. Overriding only part of the config (for example the project
 * id but not the app id) silently mixes two projects, so the whole set is read
 * from the environment and validated in `clientConfigError`.
 */
const configuredProjectId = browserProjectId();

export const firebaseConfig = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    "AIzaSyCl3C2YsBc5r7WS8HRyAtxc5r4LoC4OFfs",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    `${configuredProjectId}.firebaseapp.com`,
  projectId: isEmulator ? "demo-nexus" : configuredProjectId,
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    "ai-health-d2c5b.firebasestorage.app",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "1018985914953",
  appId:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ||
    "1:1018985914953:web:3317363b3be4ad57299598",
};

/**
 * Human-readable description of an unusable browser Firebase configuration, or
 * `null` when it is complete. Surfaced by `useAuth` instead of hanging forever.
 */
export function clientConfigError(): string | null {
  if (isEmulator) return null;
  if (!firebaseConfig.apiKey)
    return "NEXT_PUBLIC_FIREBASE_API_KEY is not set, so Firebase Authentication cannot start. Add the browser Firebase configuration to this deployment.";
  if (!configuredProjectId)
    return "NEXT_PUBLIC_FIREBASE_PROJECT_ID is not set, so Firebase Authentication cannot start.";
  return null;
}

let auth: Auth | null = null;
let firestore: Firestore | null = null;

export function getFirebaseApp() {
  if (typeof window === "undefined")
    throw new Error("Firebase client is browser-only");
  const problem = clientConfigError();
  if (problem) throw new Error(problem);
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export function getAuthInstance() {
  if (!auth) {
    auth = getAuth(getFirebaseApp());
    if (isEmulator)
      connectAuthEmulator(auth, window.location.origin, {
        disableWarnings: true,
      });
  }
  return auth;
}

export async function persistAuth() {
  await setPersistence(getAuthInstance(), browserLocalPersistence);
}

export function getDbInstance() {
  if (!firestore) {
    const app = getFirebaseApp();
    firestore = isEmulator
      ? initializeFirestore(app, {
          host: window.location.host,
          ssl: window.location.protocol === "https:",
          experimentalForceLongPolling: true,
        })
      : getFirestore(app);
  }
  return firestore;
}
