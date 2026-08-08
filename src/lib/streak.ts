/**
 * Logging streaks + consistency (roadmap 1.5). A day counts when at least
 * one diary entry exists for it. Today only extends the streak once
 * something is logged — an empty today doesn't break yesterday's run.
 */

export interface Streaks {
  /** Consecutive logged days ending today (or yesterday if today is empty). */
  current: number;
  /** Share of the last 30 days (ending today) with something logged, 0-100. */
  consistency30: number;
}

function shiftDate(date: string, days: number): string {
  const d = new Date(date + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA");
}

export function calcStreaks(loggedDates: Iterable<string>, today: string): Streaks {
  const logged = new Set(loggedDates);

  let cursor = logged.has(today) ? today : shiftDate(today, -1);
  let current = 0;
  while (logged.has(cursor)) {
    current += 1;
    cursor = shiftDate(cursor, -1);
  }

  let hit = 0;
  for (let i = 0; i < 30; i++) {
    if (logged.has(shiftDate(today, -i))) hit += 1;
  }

  return { current, consistency30: Math.round((hit / 30) * 100) };
}
