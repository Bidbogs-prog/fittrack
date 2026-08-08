import { CalendarCheck, Drop, Fire, Minus, Plus, Timer } from "@phosphor-icons/react/dist/ssr";
import type { Streaks } from "@/lib/streak";
import { logWater } from "./actions";
import { FastingStatus } from "./fasting-status";

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
  const waterPct = Math.min(100, Math.round((waterMl / waterTarget) * 100));
  const hasFasting = fastingStart != null && fastingEnd != null;

  return (
    <section
      aria-label="Habits"
      className={`grid grid-cols-2 gap-4 ${hasFasting ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}
    >
      <div className="rounded-2xl border border-ink-800 bg-ink-900/60 p-4">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-paper-mute">
          <Fire weight="fill" className={`size-3.5 ${streaks.current > 0 ? "text-lime" : ""}`} />
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

      <div className="rounded-2xl border border-ink-800 bg-ink-900/60 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-paper-mute">
              <Drop weight="fill" className={`size-3.5 ${waterPct >= 100 ? "text-lime" : ""}`} />
              Water
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold tracking-tight text-paper tabular">
              {(waterMl / 1000).toFixed(waterMl % 1000 === 0 ? 0 : 2)}
              <span className="ml-1.5 text-sm font-normal text-paper-mute">
                / {(waterTarget / 1000).toFixed(waterTarget % 1000 === 0 ? 0 : 2)} L
              </span>
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            <form action={logWater}>
              <input type="hidden" name="date" value={date} />
              <input type="hidden" name="delta" value={-250} />
              <button
                type="submit"
                disabled={waterMl <= 0}
                aria-label="Remove a 250 ml glass"
                className="btn-press rounded-lg border border-ink-700 p-2 text-paper-mute transition-colors hover:text-paper disabled:opacity-30"
              >
                <Minus weight="bold" className="size-3.5" />
              </button>
            </form>
            <form action={logWater}>
              <input type="hidden" name="date" value={date} />
              <input type="hidden" name="delta" value={250} />
              <button
                type="submit"
                aria-label="Add a 250 ml glass"
                className="btn-press rounded-lg border border-ink-700 p-2 text-paper-dim transition-colors hover:border-lime/50 hover:text-lime"
              >
                <Plus weight="bold" className="size-3.5" />
              </button>
            </form>
          </div>
        </div>
        <div
          role="progressbar"
          aria-valuenow={waterMl}
          aria-valuemin={0}
          aria-valuemax={waterTarget}
          aria-label="Water drunk"
          className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-ink-800"
        >
          <div
            className="h-full rounded-full bg-lime transition-[width] duration-300"
            style={{ width: `${waterPct}%` }}
          />
        </div>
      </div>

      {hasFasting && (
        <div className="rounded-2xl border border-ink-800 bg-ink-900/60 p-4">
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
