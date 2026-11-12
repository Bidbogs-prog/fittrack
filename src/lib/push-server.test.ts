import { beforeEach, describe, expect, it, vi } from "vitest";

const sendNotification = vi.fn();
vi.mock("web-push", () => ({ default: { setVapidDetails: vi.fn(), sendNotification } }));

describe("sendPush (DR-029)", () => {
  beforeEach(() => {
    sendNotification.mockReset();
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pub";
    process.env.VAPID_PRIVATE_KEY = "priv";
  });

  it("sends reminders with high urgency so Android delivers them while idle", async () => {
    const { sendPush, reminderPayload } = await import("./push-server");
    sendNotification.mockResolvedValue({ statusCode: 201 });
    const r = await sendPush({ endpoint: "https://fcm.googleapis.com/fcm/send/x", p256dh: "k", auth: "a" }, reminderPayload("breakfast", "en"));
    expect(r).toBe("sent");
    const opts = sendNotification.mock.calls[0][2];
    expect(opts.urgency).toBe("high");
    // Stale after 45 min: never a breakfast reminder at lunchtime.
    expect(opts.TTL).toBeLessThanOrEqual(45 * 60);
    expect(opts.TTL).toBeGreaterThanOrEqual(15 * 60);
  });

  it("maps expired subscriptions to gone", async () => {
    const { sendPush } = await import("./push-server");
    sendNotification.mockRejectedValue({ statusCode: 410 });
    expect(await sendPush({ endpoint: "https://x", p256dh: "k", auth: "a" }, { title: "t", body: "b", url: "/", tag: "t" })).toBe("gone");
  });
});
