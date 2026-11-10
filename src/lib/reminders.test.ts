import { describe, expect, it } from "vitest";
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
