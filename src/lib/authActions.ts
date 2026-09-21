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
    "auth/invalid-login-credentials": "The email or password is incorrect.",
    "auth/wrong-password": "The email or password is incorrect.",
    "auth/user-not-found": "No account exists for this email yet.",
    "auth/weak-password": "Use a password with at least 8 characters.",
    "auth/too-many-requests": "Too many attempts. Please wait and try again.",
    "auth/operation-not-allowed":
      "Enable Email/Password sign-in in the Firebase console.",
    "auth/admin-restricted-operation":
      "This sign-in method is disabled in the Firebase console (Authentication → Sign-in method).",
    "auth/unauthorized-domain":
      "This domain must be added to the Firebase Auth authorized domains.",
    "auth/configuration-not-found":
      "Firebase Authentication needs to be enabled for this project.",
    "auth/invalid-api-key":
      "Firebase rejected this deployment's API key. Check NEXT_PUBLIC_FIREBASE_API_KEY.",
    "auth/api-key-not-valid":
      "Firebase rejected this deployment's API key. Check NEXT_PUBLIC_FIREBASE_API_KEY and its authorized domains.",
    "auth/invalid-app-id":
      "The Firebase app id does not belong to this project. Check NEXT_PUBLIC_FIREBASE_APP_ID.",
    "auth/operation-not-supported":
      "This browser blocked the storage Firebase Auth needs (private windows and some embedded frames do this). Open the site in a normal tab and sign in again.",
    "auth/network-request-failed":
      "Unable to connect to Firebase. Check your connection and configuration.",
    "auth/internal-error":
      "Firebase returned an unexpected response. Confirm the project configuration and that this domain is authorized.",
  };
  return (
    (code && messages[code]) ||
    (error instanceof Error && error.message
      ? error.message
      : "Something went wrong. Please try again.")
  );
}
