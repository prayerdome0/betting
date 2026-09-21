import { db, requireServerIdentity } from "../src/lib/server/firebase";
import { updateFeed, TICK_MS } from "../src/lib/server/market";
import { processSession } from "../src/lib/server/engine";
import { recordSessionFailure } from "../src/lib/server/worker-errors";
import { FieldPath } from "firebase-admin/firestore";
import {
  WORK_QUEUE_COLLECTION,
  WORKER_DOCUMENT,
} from "../src/lib/trading/paths";
let running = true;
process.on("SIGTERM", () => {
  running = false;
});
process.on("SIGINT", () => {
  running = false;
});
async function tick() {
  await requireServerIdentity();
  const now = Date.now();
  const feed = await updateFeed(now);
  let cursor = "";
  let count = 0;
  let errors = 0;
  do {
    let pageQuery = db()
      .collection(WORK_QUEUE_COLLECTION)
      .orderBy(FieldPath.documentId())
      .limit(100);
    if (cursor) pageQuery = pageQuery.startAfter(cursor);
    const page = await pageQuery.get();
    if (page.empty) break;
    // Bounded concurrency; transactional tick deduplication supports multiple worker instances.
    for (let i = 0; i < page.docs.length; i += 10) {
      await Promise.all(
        page.docs.slice(i, i + 10).map(async (doc) => {
          const job = doc.data();
          try {
            await processSession(job.userId, job.sessionId, feed);
            count++;
          } catch (error) {
            errors++;
            console.error("Session error", job.sessionId, error);
            await recordSessionFailure(job.userId, job.sessionId, error);
          }
        }),
      );
    }
    cursor = page.docs[page.docs.length - 1].id;
  } while (running);
  await db().doc(WORKER_DOCUMENT).set({
    heartbeatAt: Date.now(),
    sessionsProcessed: count,
    sessionErrors: errors,
    environment: "SIMULATION",
    version: "1.0",
  });
}
async function main() {
  console.log(
    "NEXUS paper-trading worker started. No live execution adapter is installed.",
  );
  while (running) {
    const start = Date.now();
    try {
      await tick();
    } catch (error) {
      console.error("Worker tick failed", error);
    }
    await new Promise((resolve) =>
      setTimeout(resolve, Math.max(250, TICK_MS - (Date.now() - start))),
    );
  }
  await db().terminate();
}
void main();
