import { describe, expect, it } from "vitest";
import {
  MEAL_DEFAULT_MIN,
  dayPart,
  entryMinutes,
  formatClock,
  inWindow,
  mealForMinutes,
  parseClock,
} from "./day-time";

describe("entryMinutes", () => {
  it("uses the local log time when it falls on the entry's date", () => {
    const at = new Date(2026, 8, 29, 19, 30);
    expect(
      entryMinutes({ meal: "dinner", entry_date: "2026-09-29", created_at: at.toISOString() })
    ).toBe(19 * 60 + 30);
  });

  it("falls back to the meal's typical time for backfilled days", () => {
    const at = new Date(2026, 8, 30, 9, 0);
    expect(
      entryMinutes({ meal: "lunch", entry_date: "2026-09-29", created_at: at.toISOString() })
    ).toBe(MEAL_DEFAULT_MIN.lunch);
  });

  it("falls back when there is no log time", () => {
    expect(entryMinutes({ meal: "breakfast", entry_date: "2026-09-29" })).toBe(
      MEAL_DEFAULT_MIN.breakfast
    );
  });
});

describe("mealForMinutes", () => {
  it("maps times of day to meals", () => {
    expect(mealForMinutes(8 * 60)).toBe("breakfast");
    expect(mealForMinutes(13 * 60)).toBe("lunch");
    expect(mealForMinutes(16 * 60)).toBe("snack");
    expect(mealForMinutes(19 * 60 + 30)).toBe("dinner");
    expect(mealForMinutes(23 * 60 + 30)).toBe("snack");
    expect(mealForMinutes(2 * 60)).toBe("snack");
  });
});

describe("clock helpers", () => {
  it("parses and formats clock strings", () => {
    expect(parseClock("12:00:00")).toBe(720);
    expect(parseClock("7:05")).toBe(425);
    expect(parseClock("25:00")).toBeNull();
    expect(parseClock(null)).toBeNull();
    expect(formatClock(425)).toBe("07:05");
    expect(formatClock(1440 + 30)).toBe("00:30");
  });

  it("handles eating windows that wrap midnight", () => {
    expect(inWindow(13 * 60, 12 * 60, 20 * 60)).toBe(true);
    expect(inWindow(21 * 60, 12 * 60, 20 * 60)).toBe(false);
    expect(inWindow(23 * 60, 19 * 60, 4 * 60)).toBe(true);
    expect(inWindow(2 * 60, 19 * 60, 4 * 60)).toBe(true);
    expect(inWindow(10 * 60, 19 * 60, 4 * 60)).toBe(false);
  });

  it("names parts of the day", () => {
    expect(dayPart(8 * 60)).toBe("morning");
    expect(dayPart(14 * 60)).toBe("afternoon");
    expect(dayPart(19 * 60)).toBe("evening");
    expect(dayPart(2 * 60)).toBe("night");
  });
});
