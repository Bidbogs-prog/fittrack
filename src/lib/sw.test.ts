import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { reminderPayload } from "./push-server";

/** Static checks on public/sw.js (no browser here). */
const sw = readFileSync(join(process.cwd(), "public/sw.js"), "utf8");

describe("service worker push handler (DR-049)", () => {
  it("reminders reuse one tag per meal, so the handler must renotify", () => {
    expect(reminderPayload("breakfast", "en").tag).toBe("reminder-breakfast");
    const handler = sw.slice(sw.indexOf('addEventListener("push"'), sw.indexOf('addEventListener("notificationclick"'));
    expect(handler).toMatch(/tag:\s*data\.tag/);
    expect(handler).toMatch(/renotify:\s*true/);
  });
});
