import { NextResponse } from "next/server";
import { ApiError, verifyRequest, db } from "./firebase";
import { commandSchema } from "./validation";
import { executeCommand } from "./commands";
import { SYSTEM_EVENTS_COLLECTION } from "../trading/paths";

/**
 * `POST /api/command`. Lives outside the route file so the route can load it
 * lazily (see `startup.ts`): every answer from here is JSON with a reason, and
 * nothing may throw past this function.
 */
export async function handleCommand(request: Request) {
  try {
    const identity = await verifyRequest(request);
    const key = request.headers.get("idempotency-key");
    if (!key || !/^[a-zA-Z0-9-]{8,80}$/.test(key))
      throw new ApiError(400, "A valid idempotency key is required.");
    if (Number(request.headers.get("content-length") || 0) > 8192)
      throw new ApiError(413, "Request too large.");
    const raw = await request.text();
    if (raw.length > 8192) throw new ApiError(413, "Request too large.");
    const parsed = commandSchema.safeParse(JSON.parse(raw));
    if (!parsed.success)
      throw new ApiError(
        400,
        parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      );
    const result = await executeCommand(identity, parsed.data, key);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ApiError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    if (error instanceof SyntaxError)
      return NextResponse.json(
        { error: "Invalid JSON request." },
        { status: 400 },
      );
    console.error("Command failed", error);
    try {
      await db().collection(SYSTEM_EVENTS_COLLECTION).add({
        timestamp: Date.now(),
        kind: "ERROR",
        message:
          "Command service failed. See protected server logs for details.",
      });
    } catch {
      /* Backend unavailable. */
    }
    return NextResponse.json(
      {
        error:
          "Firebase server unavailable. Check server credentials, project configuration, and Firestore deployment.",
      },
      { status: 503 },
    );
  }
}
