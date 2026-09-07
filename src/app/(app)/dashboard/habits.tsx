import { getTranslations } from "next-intl/server";
import { CalendarCheck, Fire, Timer } from "@phosphor-icons/react/dist/ssr";
import type { Streaks } from "@/lib/streak";
import { FastingStatus } from "./fasting-status";
import { WaterTile } from "./water-tile";

/**
 * Habit strip (roadmap 1.5): real logging streak + 30-day consistency,
 * one-tap water tracking, and the optional fasting window. Server
 * component — the water buttons are plain forms into the logWater action.
 */
export async function Habits({
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
  const t = await getTranslations("dashboard");
  const hasFasting = fastingStart != null && fastingEnd != null;

  return (
    <section
      aria-label={t("habits")}
      className={`grid grid-cols-2 gap-4 ${hasFasting ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}
    >
      <div className="rounded-2xl border border-ink-800 bg-ink-900/60 p-4">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-paper-mute">
          <Fire weight="fill" className={`size-3.5 ${streaks.current > 0 ? "text-flame" : ""}`} />
          {t("streak")}
        </p>
        <p className="mt-1 font-mono text-2xl font-semibold tracking-tight text-paper tabular">
          {streaks.current}
          <span className="ms-1.5 text-sm font-normal text-paper-mute">
            {t("dayUnit", { count: streaks.current })}
          </span>
        </p>
        <p className="text-[11px] text-paper-mute">
          {streaks.current > 0 ? t("streakActive") : t("streakEmpty")}
        </p>
      </div>

      <div className="rounded-2xl border border-ink-800 bg-ink-900/60 p-4">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-paper-mute">
          <CalendarCheck weight="fill" className="size-3.5" />
          {t("consistency")}
        </p>
        <p className="mt-1 font-mono text-2xl font-semibold tracking-tight text-paper tabular">
          {streaks.consistency30}
          <span className="ms-0.5 text-sm font-normal text-paper-mute">%</span>
        </p>
        <p className="text-[11px] text-paper-mute">{t("consistencyHint")}</p>
      </div>

      <WaterTile ml={waterMl} target={waterTarget} date={date} />

      {hasFasting && (
        <div className="col-span-2 rounded-2xl border border-ink-800 bg-ink-900/60 p-4 lg:col-span-1">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-paper-mute">
            <Timer weight="fill" className="size-3.5" />
            {t("eatingWindow")}
          </p>
          <p className="mt-1 font-mono text-2xl font-semibold tracking-tight text-paper tabular">
            {fastingStart.slice(0, 5)}
            <span className="mx-1 text-sm font-normal text-paper-mute">–</span>
            {fastingEnd.slice(0, 5)}
          </p>
          <p className="mt-0.5 text-[11px] text-paper-mute">
            {isToday ? (
              <FastingStatus start={fastingStart} end={fastingEnd} />
            ) : (
              t("intermittentFasting")
            )}
          </p>
        </div>
      )}
    </section>
  );
}
