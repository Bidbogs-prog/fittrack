/**
 * Meal reminder scheduling (roadmap GTM G3). Pure, so the window rules can be
 * tested without a clock or a database. The cron sender calls `dueSlots`
 * for every user with reminders on.
 */

export const REMINDER_SLOTS = ["breakfast", "lunch", "dinner"] as const;
export type ReminderSlot = (typeof REMINDER_SLOTS)[number];

/**
 * How long after the set time a reminder may still go out. Must be longer
 * than the cron interval (30 min) so every slot is caught once; long enough
 * to survive a delayed run, short enough that "breakfast" never arrives at
 * lunchtime.
 */
export const SEND_WINDOW_MIN = 90;

export interface ReminderSchedule {
  timezone: string;
  /** "HH:MM" or "HH:MM:SS" local time, or null for no reminder. */
  breakfast: string | null;
  lunch: string | null;
  dinner: string | null;
}

/** Wall-clock date ("YYYY-MM-DD") and minutes since midnight in a timezone. */
export function localNow(now: Date, timezone: string): { date: string; minutes: number } {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
  } catch {
    // Unknown timezone string: fall back to Morocco.
    return localNow(now, "Africa/Casablanca");
  }
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

export function toMinutes(time: string | null): number | null {
  if (!time) return null;
  const m = /^(\d{2}):(\d{2})/.exec(time);
  if (!m) return null;
  const v = Number(m[1]) * 60 + Number(m[2]);
  return v >= 0 && v < 24 * 60 ? v : null;
}

/**
 * Slots to remind about right now: the set time has passed by less than
 * SEND_WINDOW_MIN, it hasn't been sent today, and that meal isn't logged yet
 * (no nagging about a meal they already logged).
 */
export function dueSlots(
  schedule: ReminderSchedule,
  /** A Date (converted with Intl) or the local clock already resolved, e.g. by Postgres. */
  now: Date | { date: string; minutes: number },
  loggedMeals: ReadonlySet<string>,
  sentToday: ReadonlySet<string>
): { date: string; slots: ReminderSlot[] } {
  const { date, minutes } = now instanceof Date ? localNow(now, schedule.timezone) : now;
  const slots = REMINDER_SLOTS.filter((slot) => {
    const at = toMinutes(schedule[slot]);
    if (at == null) return false;
    const since = minutes - at;
    return since >= 0 && since < SEND_WINDOW_MIN && !sentToday.has(slot) && !loggedMeals.has(slot);
  });
  return { date, slots };
}
