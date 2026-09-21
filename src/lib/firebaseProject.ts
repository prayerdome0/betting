/**
 * The Firebase project the *browser* is configured for.
 *
 * Shared by the client bundle and the server so both sides can agree on one
 * project. A browser that signs users into project A while the server verifies
 * their tokens with project B credentials fails every authenticated request —
 * the account created right after sign-up can never be written, and the
 * dashboard is stuck forever. Comparing against this value turns that silent
 * misconfiguration into an explicit `PROJECT_MISMATCH` diagnostic.
 */
export const DEFAULT_FIREBASE_PROJECT_ID = "ai-health-d2c5b";

export function browserProjectId() {
  return (
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || DEFAULT_FIREBASE_PROJECT_ID
  );
}
