import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Automated accessibility scan (WCAG 2.1 A/AA rules in axe-core) of the
 * public pages. Fails on serious or critical violations; minor/moderate
 * ones are attached to the report for triage. Automated scans catch roughly
 * a third of issues — the keyboard and screen-reader pass stays manual.
 */
const PAGES = ["/", "/login", "/signup", "/privacy"];

for (const path of PAGES) {
  test(`no serious accessibility violations on ${path}`, async ({ page }, info) => {
    await page.goto(path);
    // Scan the page itself, not the one-time consent dialog on top of it.
    const dialog = page.getByRole("dialog");
    if (await dialog.isVisible()) await dialog.getByRole("button").first().click();

    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    await info.attach("axe-results", { body: JSON.stringify(results.violations, null, 2), contentType: "application/json" });
    const blocking = results.violations
      .filter((v) => v.impact === "serious" || v.impact === "critical")
      .map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s) — ${v.help}`);
    expect(blocking, blocking.join("\n")).toEqual([]);
  });
}
