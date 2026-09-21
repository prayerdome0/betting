import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc } from "firebase/firestore";
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
    try {
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, "users/alice"), { balanceCents: 1000 });
        for (const collection of [
          "trades",
          "tradingSessions",
          "settings",
          "portfolio",
          "activity",
          "ledger",
          "withdrawals",
        ])
          await setDoc(doc(db, `users/alice/${collection}/record`), {
            value: 1,
          });
        await setDoc(doc(db, "systemEvents/event"), { kind: "ERROR" });
        await setDoc(doc(db, "system/market"), { source: "SYNTHETIC" });
      });
      const owner = env.authenticatedContext("alice").firestore(),
        other = env.authenticatedContext("bob").firestore(),
        admin = env.authenticatedContext("admin", { admin: true }).firestore(),
        anon = env.unauthenticatedContext().firestore();
      for (const path of [
        "users/alice",
        ...[
          "trades",
          "tradingSessions",
          "settings",
          "portfolio",
          "activity",
          "ledger",
          "withdrawals",
        ].map((c) => `users/alice/${c}/record`),
      ]) {
        await assertSucceeds(getDoc(doc(owner, path)));
        await assertSucceeds(getDoc(doc(admin, path)));
        await assertFails(getDoc(doc(other, path)));
        await assertFails(getDoc(doc(anon, path)));
        await assertFails(setDoc(doc(owner, path), { balanceCents: 999999 }));
        await assertFails(setDoc(doc(admin, path), { balanceCents: 999999 }));
      }
      await assertFails(setDoc(doc(owner, "users/alice"), { admin: true }));
      await assertFails(
        setDoc(doc(other, "users/bob"), { balanceCents: 1000 }),
      );
      await assertSucceeds(getDoc(doc(admin, "systemEvents/event")));
      await assertFails(getDoc(doc(owner, "systemEvents/event")));
      await assertFails(getDoc(doc(owner, "workQueue/alice")));
      await assertFails(getDoc(doc(owner, "users/alice/commands/key")));
      await assertSucceeds(getDoc(doc(owner, "system/market")));
      await assertFails(setDoc(doc(owner, "system/market"), { price: 99 }));
    } finally {
      await env.cleanup();
    }
  },
);
