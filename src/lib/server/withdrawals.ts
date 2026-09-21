import { z } from "zod";
import type { Firestore } from "firebase-admin/firestore";
import { ApiError, db } from "./firebase";
import { event, ledger, saveAccount } from "./commands";
import { assertAccount, readClock, type Clock } from "./invariants";
import type { Account, Withdrawal } from "../trading/types";
export const withdrawalReviewSchema = z
  .object({
    uid: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
    id: z.string().uuid(),
    status: z.enum(["Under Review", "Simulated Completed", "Cancelled"]),
  })
  .strict();
export async function reviewWithdrawal(
  actor: { uid: string; admin?: unknown },
  input: z.infer<typeof withdrawalReviewSchema>,
  clock: Clock = Date.now,
  store: Firestore = db(),
) {
  if (actor.admin !== true)
    throw new ApiError(403, "Administrator authorization is required.");
  const body = withdrawalReviewSchema.parse(input);
  const user = store.doc(`users/${body.uid}`);
  const ref = user.collection("withdrawals").doc(body.id);
  await store.runTransaction(async (tx) => {
    const [a, w] = await Promise.all([tx.get(user), tx.get(ref)]);
    if (!a.exists || !w.exists) throw new ApiError(404, "Request not found.");
    const account = a.data() as Account;
    assertAccount(account, body.uid);
    const request = w.data() as Withdrawal;
    if (
      request.userId !== body.uid ||
      request.id !== body.id ||
      !Number.isSafeInteger(request.amountCents) ||
      request.amountCents <= 0
    )
      throw new Error("Withdrawal identity/amount invariant failed.");
    if (request.status === body.status) return;
    if (!["Submitted", "Under Review"].includes(request.status))
      throw new ApiError(409, "Request is already finalized.");
    if (request.amountCents > account.withdrawalHoldCents)
      throw new Error("Withdrawal hold does not reconcile.");
    if (
      body.status === "Simulated Completed" &&
      request.status !== "Under Review"
    )
      throw new ApiError(409, "Review the request first.");
    const now = readClock(clock);
    tx.update(ref, { status: body.status, updatedAt: now });
    account.updatedAt = now;
    if (body.status !== "Under Review") {
      account.withdrawalHoldCents -= request.amountCents;
      const delta =
        body.status === "Simulated Completed" ? -request.amountCents : 0;
      account.balanceCents += delta;
      ledger(
        tx,
        user,
        body.status === "Cancelled"
          ? "WITHDRAWAL_RELEASE"
          : "SIMULATED_WITHDRAWAL",
        delta,
        account,
        request.id,
        now,
      );
    }
    event(
      tx,
      user,
      null,
      "WITHDRAWAL",
      `Request ${request.id}: ${body.status}. No real payment.`,
      now,
      account,
    );
    saveAccount(tx, user, account);
    tx.set(store.collection("systemEvents").doc(), {
      timestamp: now,
      kind: "ADMIN_AUDIT",
      actorId: actor.uid,
      userId: user.id,
      message: `Withdrawal ${request.id} marked ${body.status}.`,
    });
  });
  return { message: "Simulation request updated. No real funds transferred." };
}
