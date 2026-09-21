import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc } from "firebase/firestore";
import {
  accountPath,
  MARKET_DOCUMENT,
  NEXUS_ROOT,
  SYSTEM_EVENTS_COLLECTION,
  workQueuePath,
} from "../src/lib/trading/paths";
test(
  "Firestore rules isolate users and forbid all client/admin result mutations",
  { skip: !process.env.FIRESTORE_EMULATOR_HOST },
  async () => {
    assert.ok(process.env.FIREBASE_PROJECT_ID?.startsWith("demo-"));
    const [host, port] = process.env.FIRESTORE_EMULATOR_HOST!.split(":");
    const env = await initializeTestEnvironment({
      projectId: "demo-nexus-rules",
      firestore: {
        host,
        port: Number(port),
        rules: readFileSync("firestore.rules", "utf8"),
      },
    });
    const alice = accountPath("alice");
    const subcollections = [
      "trades",
      "tradingSessions",
      "settings",
      "portfolio",
      "activity",
      "ledger",
      "withdrawals",
    ];
    try {
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, alice), { balanceCents: 1000 });
        for (const collection of subcollections)
          await setDoc(doc(db, `${alice}/${collection}/record`), {
            value: 1,
          });
        await setDoc(doc(db, `${SYSTEM_EVENTS_COLLECTION}/event`), {
          kind: "ERROR",
        });
        await setDoc(doc(db, MARKET_DOCUMENT), { source: "SYNTHETIC" });
        // Another application's profile, sharing the project.
        await setDoc(doc(db, "users/alice"), { plan: "premium" });
      });
      const owner = env.authenticatedContext("alice").firestore(),
        other = env.authenticatedContext("bob").firestore(),
        admin = env.authenticatedContext("admin", { admin: true }).firestore(),
        anon = env.unauthenticatedContext().firestore();
      for (const path of [
        alice,
        ...subcollections.map((c) => `${alice}/${c}/record`),
      ]) {
        await assertSucceeds(getDoc(doc(owner, path)));
        await assertSucceeds(getDoc(doc(admin, path)));
        await assertFails(getDoc(doc(other, path)));
        await assertFails(getDoc(doc(anon, path)));
        await assertFails(setDoc(doc(owner, path), { balanceCents: 999999 }));
        await assertFails(setDoc(doc(admin, path), { balanceCents: 999999 }));
      }
      await assertFails(setDoc(doc(owner, alice), { admin: true }));
      await assertFails(
        setDoc(doc(other, accountPath("bob")), { balanceCents: 1000 }),
      );
      await assertFails(getDoc(doc(owner, NEXUS_ROOT)));
      await assertFails(setDoc(doc(admin, NEXUS_ROOT), { owner: "admin" }));
      await assertSucceeds(
        getDoc(doc(admin, `${SYSTEM_EVENTS_COLLECTION}/event`)),
      );
      await assertFails(
        getDoc(doc(owner, `${SYSTEM_EVENTS_COLLECTION}/event`)),
      );
      await assertFails(getDoc(doc(owner, workQueuePath("alice"))));
      await assertFails(getDoc(doc(owner, `${alice}/commands/key`)));
      await assertSucceeds(getDoc(doc(owner, MARKET_DOCUMENT)));
      await assertFails(setDoc(doc(owner, MARKET_DOCUMENT), { price: 99 }));
      // Nexus grants nothing on the other application's documents: whatever
      // access that application needs comes from its own rules, merged with
      // these — this file alone must not open `users/{uid}` to anyone.
      await assertFails(getDoc(doc(owner, "users/alice")));
      await assertFails(setDoc(doc(owner, "users/alice"), { plan: "free" }));
      await assertFails(getDoc(doc(admin, "users/alice")));
    } finally {
      await env.cleanup();
    }
  },
);
