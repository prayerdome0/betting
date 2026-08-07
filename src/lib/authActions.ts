/**
 * Firebase Auth actions + friendly error mapping.
 * Callable only from the client (event handlers).
 */

import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { getAuthInstance } from "./firebase";

export async function signInWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(getAuthInstance(), email, password);
}

export async function signUpWithEmail(email: string, password: string) {
  return createUserWithEmailAndPassword(getAuthInstance(), email, password);
}

export async function signInWithGoogle() {
  return signInWithPopup(getAuthInstance(), new GoogleAuthProvider());
}

export async function signOutUser() {
  return signOut(getAuthInstance());
}

export function friendlyAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/email-already-in-use":
      return "That email already has an account — sign in instead.";
    case "auth/invalid-email":
      return "That email address doesn't look right.";
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Wrong email or password.";
    case "auth/user-not-found":
      return "No account found for that email.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/network-request-failed":
      return "Can't reach Firebase from this environment — deploy to Vercel (or check your connection) and try again.";
    case "auth/popup-blocked":
      return "The Google sign-in popup was blocked by the browser.";
    case "auth/unauthorized-domain":
      return "This domain isn't authorized for Firebase Auth. Add it in the Firebase console: Authentication → Settings → Authorized domains.";
    default:
      return error instanceof Error ? error.message : "Something went wrong. Please try again.";
  }
}
