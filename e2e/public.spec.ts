import { expect, test } from "@playwright/test";

/** Public surface: no account or backend needed. */

test.describe("landing page", () => {
  test("loads with the waitlist and real (translated) consent text", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#waitlist")).toBeVisible();
    const banner = page.getByRole("dialog");
    await expect(banner).toBeVisible();
    // DR-003 regression: raw message keys must never reach the page.
    await expect(page.locator("body")).not.toContainText(/\b(consent|waitlist)\.[a-zA-Z]+/);
    await expect(banner.getByRole("button", { name: "Allow" })).toBeVisible();
  });

  test("consent choice is remembered", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("dialog").getByRole("button", { name: "No thanks" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await page.reload();
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("Arabic switches the document to right-to-left", async ({ page, isMobile }) => {
    test.skip(isMobile, "language switcher is hidden on small screens");
    await page.goto("/");
    await page.getByRole("button", { name: "ع" }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar-MA");
    await page.getByRole("button", { name: "EN" }).click();
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  });

  test("waitlist form rejects a malformed email before submitting", async ({ page }) => {
    await page.goto("/#waitlist");
    const email = page.locator("#waitlist input[name=email]");
    await email.fill("not-an-email");
    await page.locator("#waitlist button[type=submit]").click();
    expect(await email.evaluate((el: HTMLInputElement) => el.validity.valid)).toBe(false);
  });
});

test.describe("access control", () => {
  test("protected pages send signed-out visitors to login with a return path", async ({ page }) => {
    await page.goto("/history");
    await expect(page).toHaveURL(/\/login\?next=%2Fhistory/);
  });

  test("signup page links the legal pages", async ({ page }) => {
    await page.goto("/signup");
    const main = page.getByRole("main");
    await expect(main.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
    await expect(main.getByRole("link", { name: "Privacy policy" })).toHaveAttribute("href", "/privacy");
  });

  for (const path of ["/privacy", "/terms", "/refunds"]) {
    test(`legal page ${path} is public`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    });
  }
});

test.describe("security headers", () => {
  test("are set, and the mic and camera stay allowed for the app itself (DR-002)", async ({ request }) => {
    const res = await request.get("/");
    const h = res.headers();
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-powered-by"]).toBeUndefined();
    expect(h["permissions-policy"]).toContain("microphone=(self)");
    expect(h["permissions-policy"]).toContain("camera=(self)");
  });
});
