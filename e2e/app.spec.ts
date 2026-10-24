import { expect, test, type Page } from "@playwright/test";

/**
 * Signed-in system tests against a TEST Supabase project with the AI mocked
 * (e2e/mock-llm.mjs). Needs E2E_EMAIL / E2E_PASSWORD for an onboarded,
 * invite-cleared test user; skipped otherwise. Never point at production.
 */
const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;
test.skip(!email || !password, "set E2E_EMAIL and E2E_PASSWORD (test project only)");
test.describe.configure({ mode: "serial" });

async function signIn(page: Page) {
  await page.goto("/login");
  const dialog = page.getByRole("dialog");
  if (await dialog.isVisible()) await dialog.getByRole("button", { name: "No thanks" }).click();
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

const composer = (page: Page) => page.getByRole("textbox").last();

test("log a meal by text: parse → confirm → appears in the diary", async ({ page }) => {
  await signIn(page);
  await composer(page).fill("2 eggs and toast");
  await composer(page).press("Enter");
  const sheet = page.getByRole("dialog");
  await expect(sheet).toContainText("Eggs");
  await expect(sheet).toContainText("Toast");
  await sheet.getByRole("button", { name: /log|confirm/i }).last().click();
  await expect(page.getByText("Toast").first()).toBeVisible();
});

test("remove an item by text needs an explicit Apply", async ({ page }) => {
  await signIn(page);
  await composer(page).fill("remove the toast");
  await composer(page).press("Enter");
  const card = page.getByRole("dialog", { name: "Update your diary" });
  await expect(card).toContainText("Toast");
  await card.getByRole("button", { name: "Apply" }).click();
  await expect(card).toBeHidden();
});

test("a general question is routed to the coach, not the meal parser (DR-005)", async ({ page }) => {
  await signIn(page);
  await composer(page).fill("I feel tired lately");
  await composer(page).press("Enter");
  await expect(page).toHaveURL(/\/coach/);
  await expect(page.getByText("150 g protein")).toBeVisible();
});

test("open redirect is refused after login (DR-001)", async ({ page }) => {
  await page.goto("/login?next=%2F%09%2Fexample.org");
  const dialog = page.getByRole("dialog");
  if (await dialog.isVisible()) await dialog.getByRole("button", { name: "No thanks" }).click();
  await page.getByLabel("Email").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForLoadState("networkidle");
  expect(new URL(page.url()).host).toBe(new URL(page.context().pages()[0].url()).host);
  expect(page.url()).not.toContain("example.org");
});
