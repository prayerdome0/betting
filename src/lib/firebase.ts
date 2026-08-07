/**
 * Firebase client setup (Auth + Firestore).
 *
 * The values below are the public project identifiers for the Xacheus
 * Firebase project — safe to ship in the client bundle by design
 * (Firebase security comes from Authentication + Firestore rules, not
 * from hiding the config). Override any value via NEXT_PUBLIC_FIREBASE_*
 * env vars (e.g. to point at your own project on Vercel).
 *
 * Initialization is lazy so importing this module never touches Firebase
 * during server-side rendering — all calls happen in client effects or
 * event handlers.
 */

import { getApps, getApp, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "AIzaSyARQx_UMUz0Q2w3aggfE46WBxzli1ChziQ",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "xacheus-339ba.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "xacheus-339ba",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "xacheus-339ba.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "246733468580",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "1:246733468580:web:fa0a7693a35709b2f40731",
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (typeof window === "undefined") throw new Error("Firebase is client-only");
  if (!app) app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return app;
}

export function getAuthInstance(): Auth {
  if (!auth) auth = getAuth(getFirebaseApp());
  return auth;
}

export function getDbInstance(): Firestore {
  if (!db) db = getFirestore(getFirebaseApp());
  return db;
}
