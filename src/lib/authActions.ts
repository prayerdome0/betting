import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from "firebase/auth";
import { getAuthInstance, persistAuth } from "./firebase";
export async function signInWithEmail(email: string, password: string) {
  await persistAuth();
  return signInWithEmailAndPassword(getAuthInstance(), email, password);
}
export async function signUpWithEmail(email: string, password: string) {
  await persistAuth();
  return createUserWithEmailAndPassword(getAuthInstance(), email, password);
}
export async function resetPassword(email: string) {
  return sendPasswordResetEmail(getAuthInstance(), email);
}
export async function signOutUser() {
  return signOut(getAuthInstance());
}
export function friendlyAuthError(error: unknown) {
  const code = (error as { code?: string })?.code;
  const messages: Record<string, string> = {
    "auth/email-already-in-use":
      "This email already has an account. Sign in instead.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/invalid-credential": "The email or password is incorrect.",
    "auth/weak-password": "Use a password with at least 8 characters.",
    "auth/too-many-requests": "Too many attempts. Please wait and try again.",
    "auth/operation-not-allowed":
      "Enable Email/Password sign-in in the Firebase console.",
    "auth/unauthorized-domain":
      "This domain must be added to the Firebase Auth authorized domains.",
    "auth/configuration-not-found":
      "Firebase Authentication needs to be enabled for this project.",
    "auth/network-request-failed":
      "Unable to connect to Firebase. Check your connection and configuration.",
  };
  return (
    (code && messages[code]) ||
    (error instanceof Error
      ? error.message
      : "Something went wrong. Please try again.")
  );
}
