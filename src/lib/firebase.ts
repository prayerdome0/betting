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
export const isEmulator = process.env.NEXT_PUBLIC_FIREBASE_EMULATORS === "true";
export const firebaseConfig = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    "AIzaSyCl3C2YsBc5r7WS8HRyAtxc5r4LoC4OFfs",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    "ai-health-d2c5b.firebaseapp.com",
  projectId: isEmulator
    ? "demo-nexus"
    : process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "ai-health-d2c5b",
  storageBucket: "ai-health-d2c5b.firebasestorage.app",
  messagingSenderId: "1018985914953",
  appId: "1:1018985914953:web:3317363b3be4ad57299598",
};
let auth: Auth | null = null;
let firestore: Firestore | null = null;
export function getFirebaseApp() {
  if (typeof window === "undefined")
    throw new Error("Firebase client is browser-only");
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
