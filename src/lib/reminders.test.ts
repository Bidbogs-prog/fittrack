import { describe, expect, it } from "vitest";
import { blockedSlots, retryable } from "./reminders";
import { implausibleSlots } from "./reminders";
import { dueSlots, localNow, SEND_WINDOW_MIN, toMinutes, type ReminderSchedule } from "./reminders";

/**
 * Reminder timing — boundary value analysis on the send window and
 * timezone handling. Morocco is UTC+1 outside Ramadan; tests use fixed UTC
 * instants and assert the local reading so they don't depend on the
 * machine's timezone.
 */
const schedule: ReminderSchedule = {
  timezone: "Africa/Casablanca",
  breakfast: "09:00",
  lunch: "13:30:00",
  dinner: "20:30",
};
const none = new Set<string>();

/** A UTC instant whose Casablanca wall clock is `hh:mm` on 2026-11-02. */
function at(hh: number, mm: number): Date {
  const probe = new Date(Date.UTC(2026, 10, 2, 12, 0));
  const offsetMin = localNow(probe, "Africa/Casablanca").minutes - 12 * 60;
  return new Date(Date.UTC(2026, 10, 2, hh, mm) - offsetMin * 60_000);
}

describe("localNow", () => {
  it("reads wall-clock time in the user's timezone", () => {
    expect(localNow(at(9, 0), "Africa/Casablanca")).toEqual({ date: "2026-11-02", minutes: 9 * 60 });
  });
  it("falls back to Casablanca for an unknown timezone", () => {
    expect(localNow(at(9, 0), "Not/AZone")).toEqual(localNow(at(9, 0), "Africa/Casablanca"));
  });
});

describe("send window (BVA)", () => {
  it("one minute before the set time → not due", () => {
    expect(dueSlots(schedule, at(8, 59), none, none).slots).toEqual([]);
  });
  it("exactly at the set time → due", () => {
    expect(dueSlots(schedule, at(9, 0), none, none).slots).toEqual(["breakfast"]);
  });
  it("last minute of the window → due", () => {
    const end = 9 * 60 + SEND_WINDOW_MIN - 1;
    expect(dueSlots(schedule, at(Math.floor(end / 60), end % 60), none, none).slots).toEqual(["breakfast"]);
  });
  it("window closed → not due", () => {
    const end = 9 * 60 + SEND_WINDOW_MIN;
    expect(dueSlots(schedule, at(Math.floor(end / 60), end % 60), none, none).slots).toEqual([]);
  });
  it("seconds in the stored time are ignored", () => {
    expect(dueSlots(schedule, at(13, 30), none, none).slots).toEqual(["lunch"]);
  });
});

describe("suppression", () => {
  it("already sent today → not sent again", () => {
    expect(dueSlots(schedule, at(9, 10), none, new Set(["breakfast"])).slots).toEqual([]);
  });
  it("meal already logged → no reminder", () => {
    expect(dueSlots(schedule, at(20, 45), new Set(["dinner"]), none).slots).toEqual([]);
  });
  it("slot turned off (null) → never due", () => {
    expect(dueSlots({ ...schedule, lunch: null }, at(13, 30), none, none).slots).toEqual([]);
  });
  it("reports the local date for the dedupe key", () => {
    expect(dueSlots(schedule, at(20, 30), none, none).date).toBe("2026-11-02");
  });
});

describe("pre-resolved local clock (from Postgres)", () => {
  it("uses the given local time, ignoring the runtime's timezone data", () => {
    // Lunch is 13:30 here: 15:00 is 90 min later (window closed), 13:38 is inside it.
    expect(dueSlots(schedule, { date: "2026-11-10", minutes: 15 * 60 }, none, none).slots).toEqual([]);
    expect(dueSlots(schedule, { date: "2026-11-10", minutes: 13 * 60 + 38 }, none, none)).toEqual({
      date: "2026-11-10",
      slots: ["lunch"],
    });
  });
});

describe("toMinutes", () => {
  it.each([
    ["00:00", 0],
    ["23:59", 1439],
    ["09:30:00", 570],
    ["24:00", null],
    ["9:30", null],
    [null, null],
  ])("%s → %s", (input, expected) => expect(toMinutes(input)).toBe(expected));
});


describe("implausibleSlots (DR-030)", () => {
  it("flags an AM/PM slip: lunch 23:47 instead of 11:47", () => {
    expect(implausibleSlots({ breakfast: "10:28", lunch: "23:47", dinner: "21:00" })).toEqual(["lunch"]);
  });
  it("accepts normal times, late dinners and empty slots", () => {
    expect(implausibleSlots({ breakfast: "07:30", lunch: "13:00", dinner: "00:30" })).toEqual([]);
    expect(implausibleSlots({ breakfast: null, lunch: "11:48", dinner: null })).toEqual([]);
  });
  it("flags breakfast in the evening and dinner in the morning", () => {
    expect(implausibleSlots({ breakfast: "19:00", lunch: null, dinner: "09:00" })).toEqual(["breakfast", "dinner"]);
  });
});


describe("retry after a failed send (AUD-06)", () => {
  const now = new Date("2026-11-12T12:00:00Z");
  const ago = (min: number) => new Date(now.getTime() - min * 60_000).toISOString();
  it("a sent slot is done", () => {
    expect(retryable({ slot: "lunch", status: "sent", attempts: 1, updated_at: ago(60) }, now)).toBe(false);
  });
  it("a failed slot is retried after 4 minutes, up to 3 attempts", () => {
    expect(retryable({ slot: "lunch", status: "failed", attempts: 1, updated_at: ago(3) }, now)).toBe(false);
    expect(retryable({ slot: "lunch", status: "failed", attempts: 1, updated_at: ago(5) }, now)).toBe(true);
    expect(retryable({ slot: "lunch", status: "failed", attempts: 3, updated_at: ago(30) }, now)).toBe(false);
  });
  it("a claim left by a crashed run is retried after 5 minutes", () => {
    expect(retryable({ slot: "lunch", status: "claimed", attempts: 1, updated_at: ago(2) }, now)).toBe(false);
    expect(retryable({ slot: "lunch", status: "claimed", attempts: 1, updated_at: ago(6) }, now)).toBe(true);
  });
  it("only blocked slots are excluded", () => {
    const rows = [
      { slot: "breakfast", status: "sent" as const, attempts: 1, updated_at: ago(200) },
      { slot: "lunch", status: "failed" as const, attempts: 1, updated_at: ago(10) },
    ];
    expect([...blockedSlots(rows, now)]).toEqual(["breakfast"]);
  });
});
