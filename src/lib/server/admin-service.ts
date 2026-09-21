import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, db, verifyRequest } from "./firebase";
import { reviewWithdrawal, withdrawalReviewSchema } from "./withdrawals";
import {
  accountPath,
  ACCOUNTS_COLLECTION,
  SYSTEM_EVENTS_COLLECTION,
  WORKER_DOCUMENT,
} from "../trading/paths";
/**
 * `GET`/`POST /api/admin`. Lives outside the route file so the route can load
 * it lazily (see `startup.ts`); every answer is JSON with a reason.
 */
const uidSchema = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
async function admin(request: Request) {
  const identity = await verifyRequest(request);
  if (identity.admin !== true)
    throw new ApiError(403, "Administrator authorization is required.");
  return identity;
}
function errorResponse(error: unknown) {
  if (error instanceof ApiError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  if (error instanceof z.ZodError || error instanceof SyntaxError)
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  console.error("Admin service error", error);
  return NextResponse.json(
    { error: "Admin service unavailable." },
    { status: 503 },
  );
}
export async function handleAdminGet(request: Request) {
  try {
    await admin(request);
    const url = new URL(request.url);
    const uid = url.searchParams.get("uid");
    if (uid) {
      uidSchema.parse(uid);
      const allowed = {
        trades: "startedAt",
        tradingSessions: "startedAt",
        withdrawals: "createdAt",
        activity: "sequence",
        ledger: "sequence",
      } as const;
      const kind = z
        .enum([
          "trades",
          "tradingSessions",
          "withdrawals",
          "activity",
          "ledger",
        ])
        .parse(url.searchParams.get("kind") || "trades");
      const cursor = url.searchParams.get("cursor");
      let query = db()
        .collection(`${accountPath(uid)}/${kind}`)
        .orderBy(allowed[kind], "desc")
        .orderBy("__name__", "desc")
        .limit(50);
      if (cursor) {
        if (!/^[A-Za-z0-9-]{1,128}$/.test(cursor))
          throw new ApiError(400, "Invalid cursor.");
        const doc = await db()
          .doc(`${accountPath(uid)}/${kind}/${cursor}`)
          .get();
        if (doc.exists) query = query.startAfter(doc);
      }
      const rows = await query.get();
      return NextResponse.json({
        rows: rows.docs.map((d) => ({ ...d.data(), id: d.id })),
        next: rows.size === 50 ? rows.docs.at(-1)!.id : null,
      });
    }
    const cursor = url.searchParams.get("cursor");
    let usersQuery = db()
      .collection(ACCOUNTS_COLLECTION)
      .orderBy("createdAt", "desc")
      .orderBy("__name__", "desc")
      .limit(50);
    if (cursor) {
      uidSchema.parse(cursor);
      const last = await db().doc(accountPath(cursor)).get();
      if (last.exists) usersQuery = usersQuery.startAfter(last);
    }
    const [users, errors, worker] = await Promise.all([
      usersQuery.get(),
      db()
        .collection(SYSTEM_EVENTS_COLLECTION)
        .orderBy("timestamp", "desc")
        .limit(50)
        .get(),
      db().doc(WORKER_DOCUMENT).get(),
    ]);
    return NextResponse.json({
      users: users.docs.map((d) => d.data()),
      next: users.size === 50 ? users.docs.at(-1)!.id : null,
      events: errors.docs.map((d) => ({ ...d.data(), id: d.id })),
      worker: worker.data() || null,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function handleAdminPost(request: Request) {
  try {
    const identity = await admin(request);
    const body = withdrawalReviewSchema.parse(await request.json());
    return NextResponse.json(await reviewWithdrawal(identity, body));
  } catch (error) {
    return errorResponse(error);
  }
}
