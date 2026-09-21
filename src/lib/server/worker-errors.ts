import type { Firestore } from "firebase-admin/firestore";
import { db } from "./firebase";
import { readClock, type Clock } from "./invariants";
import { accountPath, SYSTEM_EVENTS_COLLECTION } from "../trading/paths";
export async function recordSessionFailure(
  userId: string,
  sessionId: string,
  error: unknown,
  clock: Clock = Date.now,
  store: Firestore = db(),
) {
  const ref = store.doc(`${accountPath(userId)}/tradingSessions/${sessionId}`);
  await store.runTransaction(async (tx) => {
    const [s, a] = await Promise.all([
      tx.get(ref),
      tx.get(store.doc(accountPath(userId))),
    ]);
    // A late failure from an old job must not flag a new or completed session.
    if (
      !s.exists ||
      a.data()?.activeSessionId !== sessionId ||
      !["ACTIVE", "PAUSED", "STOPPING"].includes(s.data()!.status)
    )
      return;
    if (s.data()!.engineError) return; // Avoid an identical error document every five seconds.
    const now = readClock(clock);
    tx.update(ref, {
      engineError: {
        code: "EXECUTION_BLOCKED",
        occurredAt: now,
        message:
          "The worker could not safely process this session. Check the last recorded state. Processing will retry automatically; no browser-side trades will be invented.",
      },
    });
    tx.set(store.collection(SYSTEM_EVENTS_COLLECTION).doc(), {
      timestamp: now,
      kind: "ERROR",
      userId,
      sessionId,
      message:
        error instanceof Error ? error.message : "Worker execution error",
    });
  });
}
