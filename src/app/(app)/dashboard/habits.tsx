import { getTranslations } from "next-intl/server";
import type { Streaks } from "@/lib/streak";
import { WaterTile } from "./water-tile";

/**
 * Habit strip (roadmap 1.5) for the right rail: logging streak, one-tap
 * water, and the day's steps (logged in the Activity card).
 */
export async function Habits({
  streaks,
  waterMl,
  waterTarget,
  date,
  steps,
}: {
  streaks: Streaks;
  waterMl: number;
  waterTarget: number;
  date: string;
  steps: number | null;
}) {
  const t = await getTranslations("habits");
  return (
    <section aria-label={t("label")} className="grid grid-cols-3 gap-2">
      <div
        className="rounded-[14px] border border-ink-800 bg-ink-900 p-2.5"
        title={t("consistency", { pct: streaks.consistency30 })}
      >
        <p className="text-[11px] text-paper-mute">{t("streak")}</p>
        <p className="font-mono text-base font-medium text-flame-glow tabular">
          {streaks.current}
          {t("daysShort")}
        </p>
        <p className="truncate text-[10px] text-paper-mute">{t("consistencyShort", { pct: streaks.consistency30 })}</p>
      </div>
      <WaterTile ml={waterMl} target={waterTarget} date={date} />
      <div className="rounded-[14px] border border-ink-800 bg-ink-900 p-2.5">
        <p className="text-[11px] text-paper-mute">{t("steps")}</p>
        <p className="font-mono text-base font-medium text-paper tabular">
          {steps == null ? "—" : steps >= 1000 ? `${(steps / 1000).toFixed(1)}k` : steps}
        </p>
        <p className="truncate text-[10px] text-paper-mute">{t("stepsHint")}</p>
      </div>
    </section>
  );
}
