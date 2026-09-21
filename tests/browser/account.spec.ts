import { test, expect } from "@playwright/test";
// These cases require official Auth/Firestore emulators AND the independent worker.
test("account, settings, trades, and session survive reopening; withdrawals are reserved and cancelled", async ({
  page,
  context,
}, info) => {
  test.skip(
    process.env.E2E_FIREBASE_EMULATORS !== "true" ||
      info.project.name !== "desktop",
    "Run with the official Firebase emulators and worker.",
  );
  test.setTimeout(100000);
  await page.goto("/");
  await page.getByRole("button", { name: "Open simulation account" }).click();
  await page
    .getByLabel("Email address")
    .fill(`trader-${Date.now()}@example.test`);
  await page.getByLabel("Password", { exact: true }).fill("SimulatedPass123!");
  await page
    .getByRole("button", { name: "Create simulation account", exact: true })
    .click();
  await expect(page.locator(".balance-card h2")).toContainText("$10.00", {
    timeout: 20000,
  });
  await page
    .getByRole("button", { name: "Configure funds", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Configure virtual balance", exact: true })
    .click();
  await expect(
    page.getByText("Your current simulated balance is"),
  ).toContainText("$500.00");
  await page.getByLabel("Trade allocation (USD)").fill("100");
  await page.getByLabel("Maximum holding time (seconds)").fill("20");
  await page
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(page.locator(".balance-card h2")).toContainText("$500.00");
  await page.reload();
  await expect(page.locator(".balance-card h2")).toContainText("$500.00");
  await page
    .getByLabel("Session duration", { exact: true })
    .selectOption("custom");
  await page.getByLabel("Custom duration (minutes, 1–10,080)").fill("1");
  await page
    .getByRole("button", { name: "Start AI trading", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "STOP AI TRADING", exact: true }),
  ).toBeVisible({ timeout: 15000 });
  const before = await page.locator(".timer>span").textContent();
  await page.close();
  // Server execution continues without a page or browser timer.
  await new Promise((resolve) => setTimeout(resolve, 30000));
  const reopened = await context.newPage();
  await reopened.goto("/");
  await expect(reopened.locator(".timer>span")).not.toHaveText(before!);
  await reopened
    .getByRole("button", { name: "Trade history", exact: true })
    .click();
  await expect(reopened.locator("tbody tr").first()).toBeVisible({
    timeout: 15000,
  });
  await reopened
    .getByRole("button", { name: "AI sessions", exact: true })
    .click();
  await reopened
    .getByRole("button", { name: "STOP AI TRADING", exact: true })
    .click();
  await expect(
    reopened.getByRole("button", { name: "Start AI trading", exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await reopened
    .getByRole("button", { name: "Withdrawals", exact: true })
    .click();
  const available = await reopened.locator(".available-box b").textContent();
  await reopened.getByLabel("Amount (USD)", { exact: true }).fill("1");
  await reopened.getByLabel("Account holder name").fill("Fictional Trader");
  await reopened
    .getByLabel("Fictional account / payment details")
    .fill("Fictional account 0000");
  await reopened
    .getByRole("button", { name: "Submit simulation request" })
    .click();
  await expect(reopened.getByText("Submitted", { exact: true })).toBeVisible();
  await reopened
    .getByRole("button", { name: "Cancel request", exact: true })
    .click();
  await expect(reopened.getByText("Cancelled", { exact: true })).toBeVisible();
  await expect(reopened.locator(".available-box b")).toHaveText(available!);
});
