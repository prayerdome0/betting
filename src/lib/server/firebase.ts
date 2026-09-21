import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
export function adminApp() {
  const projectId = process.env.FIREBASE_PROJECT_ID || "ai-health-d2c5b";
  const emulator = !!(
    process.env.FIRESTORE_EMULATOR_HOST ||
    process.env.FIREBASE_AUTH_EMULATOR_HOST
  );
  if (
    emulator &&
    (!projectId.startsWith("demo-") ||
      !process.env.FIRESTORE_EMULATOR_HOST ||
      !process.env.FIREBASE_AUTH_EMULATOR_HOST)
  ) {
    throw new Error(
      "Auth and Firestore emulators must be configured together with a demo-* project. Mixing emulator identity and production data is forbidden.",
    );
  }
  if (process.env.NEXT_PUBLIC_FIREBASE_EMULATORS === "true" && !emulator)
    throw new Error(
      "The emulator client requires both server emulator connections.",
    );
  return (
    getApps()[0] ||
    initializeApp({
      projectId,
      ...(process.env.FIRESTORE_EMULATOR_HOST
        ? {}
        : { credential: applicationDefault() }),
    })
  );
}
// Validate ADC before starting Firestore's background gRPC client. Without this,
// missing credentials can spawn repeated background retries during health checks.
let identityCheck: Promise<void> | undefined;
let identityCheckedAt = 0;
export async function requireServerIdentity() {
  const app = adminApp();
  if (process.env.FIRESTORE_EMULATOR_HOST) return;
  if (!identityCheck || Date.now() - identityCheckedAt > 60000) {
    identityCheckedAt = Date.now();
    identityCheck = app.options
      .credential!.getAccessToken()
      .then(() => undefined);
  }
  await identityCheck;
}
export const db = () => getFirestore(adminApp());
export const adminAuth = () => getAuth(adminApp());
export async function verifyRequest(request: Request) {
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new ApiError(401, "Please sign in to continue.");
  try {
    await requireServerIdentity();
    return await adminAuth().verifyIdToken(token, true);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (
      code &&
      [
        "auth/id-token-expired",
        "auth/id-token-revoked",
        "auth/user-disabled",
        "auth/user-not-found",
        "auth/argument-error",
        "auth/invalid-id-token",
        "auth/invalid-argument",
      ].includes(code)
    ) {
      throw new ApiError(
        401,
        "Your sign-in is invalid or expired. Please sign in again.",
      );
    }
    console.error("Server token verification unavailable", error);
    throw new ApiError(
      503,
      "Firebase server authentication is unavailable. Configure the server identity and verify Firebase project access.",
    );
  }
}
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
