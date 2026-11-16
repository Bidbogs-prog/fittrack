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
    expect(sw).toMatch(/renotify:\s*true/);
  });

  it("acks delivery to /api/push/ack after showing the notification", () => {
    const fn = sw.slice(sw.indexOf("async function showAndAck"));
    expect(fn.indexOf("showNotification")).toBeLessThan(fn.indexOf("/api/push/ack"));
    expect(reminderPayload("lunch", "en", "2026-11-16").ack).toEqual({ slot: "lunch", date: "2026-11-16" });
  });
});
