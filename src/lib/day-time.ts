import type { MealType } from "./types";

/**
 * Minute-of-day helpers for the orbit (24-hour dial). Diary entries have
 * no "eaten at" column; the orbit places a meal at the local time it was
 * logged (created_at) when that falls on the entry's own date, and at the
 * meal's typical time otherwise (backfilled or copied days). These run in
 * the browser — only the viewer knows their local time.
 */

/** Typical times, used when an entry's log time says nothing about the day. */
export const MEAL_DEFAULT_MIN: Record<MealType, number> = {
  breakfast: 8 * 60 + 30,
  lunch: 13 * 60,
  snack: 16 * 60 + 30,
  dinner: 19 * 60 + 30,
};

/** Local date string (YYYY-MM-DD) for a Date. */
export function localDate(d: Date): string {
  return d.toLocaleDateString("en-CA");
}

export function minutesOfDate(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/** Where on the dial an entry sits. */
export function entryMinutes(
  entry: { meal: MealType; entry_date: string; created_at?: string | null },
): number {
  if (entry.created_at) {
    const at = new Date(entry.created_at);
    if (!Number.isNaN(at.getTime()) && localDate(at) === entry.entry_date) {
      return minutesOfDate(at);
    }
  }
  return MEAL_DEFAULT_MIN[entry.meal];
}

/** The meal a log most likely belongs to at a given time of day. */
export function mealForMinutes(min: number): MealType {
  if (min >= 4 * 60 && min < 10 * 60 + 30) return "breakfast";
  if (min >= 10 * 60 + 30 && min < 15 * 60) return "lunch";
  if (min >= 15 * 60 && min < 18 * 60) return "snack";
  if (min >= 18 * 60 && min < 22 * 60 + 30) return "dinner";
  return "snack";
}

/** "HH:MM" or "HH:MM:SS" to minutes; null when unparseable. */
export function parseClock(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Minutes to "HH:MM" (wraps past midnight). */
export function formatClock(min: number): string {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Whether a minute-of-day falls inside a window (which may wrap midnight). */
export function inWindow(min: number, startMin: number, endMin: number): boolean {
  return startMin <= endMin ? min >= startMin && min < endMin : min >= startMin || min < endMin;
}

export type DayPart = "morning" | "afternoon" | "evening" | "night";

export function dayPart(min: number): DayPart {
  if (min >= 5 * 60 && min < 12 * 60) return "morning";
  if (min >= 12 * 60 && min < 18 * 60) return "afternoon";
  if (min >= 18 * 60 && min < 23 * 60) return "evening";
  return "night";
}
