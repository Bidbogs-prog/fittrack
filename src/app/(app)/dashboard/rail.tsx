import { getTranslations } from "next-intl/server";
import { MacroBars } from "@/components/macros";
import { MicroPanel } from "@/components/micros";
import { displayWeight, weightUnit } from "@/lib/units";
import { ActivityCard } from "./activity-card";
import type { DayData } from "./day-data";
import { Habits } from "./habits";
import { WeightCard } from "./weight-card";

/**
 * The right rail on Today and Coach (desktop): macros with fibre, habits,
 * weight, activity and micros. Below lg it stacks under the thread.
 */
export async function DayRail({ data }: { data: DayData }) {
  const t = await getTranslations("today");
  const { adaptive, profile } = data;

  return (
    <aside
      aria-label={t("railLabel")}
      className="flex flex-col gap-3.5 max-lg:mt-6 lg:sticky lg:top-0 lg:h-[100dvh] lg:overflow-y-auto lg:border-s lg:border-ink-800 lg:px-5 lg:py-6"
    >
      <div className="max-lg:hidden">
        <MacroBars eaten={data.eaten} targets={data.targets} />
      </div>
      {adaptive && (
        <p className="text-[11px] leading-relaxed text-paper-mute max-lg:order-last">
          {t("adaptiveNote", {
            days: adaptive.spanDays,
            intake: adaptive.intakeAvg,
            dir: adaptive.weightDeltaKg <= 0 ? "down" : "up",
            delta: displayWeight(Math.abs(adaptive.weightDeltaKg), profile.units).toFixed(1),
            unit: weightUnit(profile.units),
            tdee: adaptive.tdee,
          })}
        </p>
      )}
      <div className="lg:border-t lg:border-ink-800 lg:pt-3.5">
        <Habits
          streaks={data.streaks}
          waterMl={data.waterMl}
          waterTarget={data.waterTarget}
          date={data.date}
          steps={data.steps}
        />
      </div>
      <WeightCard
        points={data.trendPoints}
        delta={data.weightDelta}
        date={data.date}
        isToday={data.isToday}
        defaultWeight={profile.weight_kg}
        units={profile.units}
      />
      <ActivityCard
        date={data.date}
        exercises={data.exercises}
        steps={data.steps}
        adaptive={adaptive != null}
      />
      <MicroPanel totals={data.microTotals} />
    </aside>
  );
}
