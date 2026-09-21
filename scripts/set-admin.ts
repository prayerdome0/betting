import { adminAuth } from "../src/lib/server/firebase";
async function main() {
  const uid = process.argv[2];
  if (!uid)
    throw new Error(
      "Usage: tsx scripts/set-admin.ts <firebase-auth-uid> [revoke]",
    );
  const user = await adminAuth().getUser(uid);
  await adminAuth().setCustomUserClaims(uid, {
    ...user.customClaims,
    admin: process.argv[3] !== "revoke",
  });
  console.log(
    "Admin claim updated. User must sign out and back in. No balances or trades modified.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
