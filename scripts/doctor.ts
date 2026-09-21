import { db } from "../src/lib/server/firebase";
import { getServiceHealth } from "../src/lib/server/health";
async function main() {
  const health = await getServiceHealth();
  if (process.argv.includes("--json"))
    console.log(JSON.stringify(health, null, 2));
  else {
    console.log(`\nNEXUS deployment readiness · ${health.environment}\n`);
    for (const [name, ready] of Object.entries(health.checks))
      console.log(`${ready ? "OK  " : "WAIT"}  ${name}`);
    console.log(`\n${health.status}: ${health.message}\n`);
    console.log(
      "This is read-only. It does not create an account, mutate balances, deploy rules, or verify Auth provider configuration.",
    );
    console.log(
      "Use README.md and the official Firebase integration suite before deployment.\n",
    );
  }
  if (health.checks.identity) await db().terminate();
  if (health.status !== "READY") process.exitCode = 1;
}
main().catch(() => {
  console.error(
    "Readiness check could not complete. Check server configuration; no credentials are printed.",
  );
  process.exitCode = 1;
});
