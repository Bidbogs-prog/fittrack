import { CalendarCheck, Fire, Timer } from "@phosphor-icons/react/dist/ssr";
import type { Streaks } from "@/lib/streak";
import { FastingStatus } from "./fasting-status";
import { WaterTile } from "./water-tile";

/**
 * Habit strip (roadmap 1.5): real logging streak + 30-day consistency,
 * one-tap water tracking, and the optional fasting window. Server
 * component — the water buttons are plain forms into the logWater action.
 */
export function Habits({
  streaks,
  waterMl,
  waterTarget,
  date,
  isToday,
  fastingStart,
  fastingEnd,
}: {
  streaks: Streaks;
  waterMl: number;
  waterTarget: number;
  date: string;
  isToday: boolean;
  fastingStart: string | null;
  fastingEnd: string | null;
}) {
  const hasFasting = fastingStart != null && fastingEnd != null;

  return (
    <section
      aria-label="Habits"
      className={`grid grid-cols-2 gap-4 ${hasFasting ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}
    >
      <div className="rounded-2xl border border-ink-800 bg-ink-900/60 p-4">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-paper-mute">
          <Fire weight="fill" className={`size-3.5 ${streaks.current > 0 ? "text-flame" : ""}`} />
          Streak
        </p>
        <p className="mt-1 font-mono text-2xl font-semibold tracking-tight text-paper tabular">
          {streaks.current}
          <span className="ml-1.5 text-sm font-normal text-paper-mute">
            day{streaks.current === 1 ? "" : "s"}
          </span>
        </p>
        <p className="text-[11px] text-paper-mute">
          {streaks.current > 0 ? "consecutive days logged" : "log a meal to start one"}
        </p>
      </div>

      <div className="rounded-2xl border border-ink-800 bg-ink-900/60 p-4">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-paper-mute">
          <CalendarCheck weight="fill" className="size-3.5" />
          Consistency
        </p>
        <p className="mt-1 font-mono text-2xl font-semibold tracking-tight text-paper tabular">
          {streaks.consistency30}
          <span className="ml-0.5 text-sm font-normal text-paper-mute">%</span>
        </p>
        <p className="text-[11px] text-paper-mute">of the last 30 days logged</p>
      </div>

      <WaterTile ml={waterMl} target={waterTarget} date={date} />

      {hasFasting && (
        <div className="col-span-2 rounded-2xl border border-ink-800 bg-ink-900/60 p-4 lg:col-span-1">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-paper-mute">
            <Timer weight="fill" className="size-3.5" />
            Eating window
          </p>
          <p className="mt-1 font-mono text-2xl font-semibold tracking-tight text-paper tabular">
            {fastingStart.slice(0, 5)}
            <span className="mx-1 text-sm font-normal text-paper-mute">–</span>
            {fastingEnd.slice(0, 5)}
          </p>
          <p className="mt-0.5 text-[11px] text-paper-mute">
            {isToday ? <FastingStatus start={fastingStart} end={fastingEnd} /> : "intermittent fasting"}
          </p>
        </div>
      )}
    </section>
  );
}
