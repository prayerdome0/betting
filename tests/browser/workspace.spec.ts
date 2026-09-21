import { test, expect } from "@playwright/test";
test("guest dashboard is honest, responsive, and interactive", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Trading overview" }),
  ).toBeVisible();
  await expect(page.getByText("VIRTUAL FUNDS", { exact: true })).toBeVisible();
  await expect(
    page.getByText("A fresh start. A clear perspective."),
  ).toBeVisible();
  const bounds = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    width: innerWidth,
  }));
  expect(bounds.scroll).toBeLessThanOrEqual(bounds.width);
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await page.getByRole("button", { name: "Open simulation account" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("Email address")).toBeVisible();
  await page.getByRole("button", { name: "Forgot your password?" }).click();
  await expect(
    page.getByRole("button", { name: "Send reset link" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("button", { name: "AI sessions", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Your AI, at work." }),
  ).toBeVisible();
  await page
    .getByLabel("Session duration", { exact: true })
    .selectOption("custom");
  await expect(
    page.getByLabel("Custom duration (minutes, 1–10,080)"),
  ).toBeVisible();
  await page
    .getByLabel("Session duration", { exact: true })
    .selectOption("unlimited");
  await page
    .getByRole("button", { name: "Start AI trading", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(errors).toEqual([]);
});
test("unauthenticated endpoints cannot mutate balances or read admin data", async ({
  request,
}) => {
  const command = await request.post("/api/command", {
    data: { action: "balance", balanceCents: 999999 },
  });
  expect(command.status()).toBe(401);
  const admin = await request.get("/api/admin");
  expect(admin.status()).toBe(401);
  expect(
    (
      await request.post("/api/simulation/state", { data: { balance: 999999 } })
    ).status(),
  ).toBe(404);
});

test("settings exposes real readiness checks and offline state without inventing a connection", async ({
  page,
  context,
}, info) => {
  await page.goto("/");
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "System connection", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".system-checks>div")).toHaveCount(4);
  await expect(
    page.getByText("Independent worker", { exact: true }),
  ).toBeVisible();
  const health = await (await context.request.get("/api/health")).json();
  expect(health.checks).toHaveProperty("identity");
  expect(health.checks).toHaveProperty("database");
  expect(health.checks).toHaveProperty("worker");
  expect(health.checks).toHaveProperty("feed");
  expect(JSON.stringify(health)).not.toContain("private_key");
  await context.setOffline(true);
  await expect(
    page.getByRole("status").filter({ hasText: "You are offline." }),
  ).toBeVisible();
  await expect(
    page.getByText("Offline · showing last received data", { exact: true }),
  ).toBeVisible();
  await context.setOffline(false);
  await expect(
    page.getByRole("status").filter({ hasText: "You are offline." }),
  ).toHaveCount(0);
  const dimensions = await page.evaluate(() => ({
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width);
});
