"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CaretDown } from "@phosphor-icons/react";
import { addDiaryEntry } from "@/app/(app)/dashboard/actions";
import { LOW_DV_PCT } from "@/components/micros-shared";
import { track } from "@/lib/analytics";
import { localDate, mealForMinutes, minutesOfDate } from "@/lib/day-time";
import { MICRONUTRIENTS, formatAmount, macrosForPortion, microsForPortion, percentDv, round1 } from "@/lib/nutrition";
import { enqueue } from "@/lib/offline-queue";
import { MEAL_TYPES, MICRO_KEYS, type Food, type MealType } from "@/lib/types";
import { useClientValue } from "@/lib/use-client-clock";

const STEP = 5;

/**
 * Portion picker for one food. Grams are the source of truth: the slider
 * and serving chips only set grams, and every number derives from the
 * per-100 g facts via nutrition.ts.
 */
export function Portion({ food }: { food: Food }) {
  const t = useTranslations("foods");
  const tm = useTranslations("meals");
  const router = useRouter();
  const serving = food.serving_grams && food.serving_grams > 0 ? food.serving_grams : null;
  const [grams, setGrams] = useState(serving ?? 100);
  const nowMeal = useClientValue(() => mealForMinutes(minutesOfDate(new Date())), "snack" as MealType);
  const [mealChoice, setMealChoice] = useState<MealType | null>(null);
  const meal = mealChoice ?? nowMeal;
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [pending, startTransition] = useTransition();

  const max = Math.max(400, Math.ceil(((serving ?? 0) * 2) / 50) * 50);
  const m = macrosForPortion(food, grams);
  const micros = microsForPortion(food, grams);
  const microRows = MICRO_KEYS.flatMap((key) => {
    const value = micros[key];
    const def = MICRONUTRIENTS[key];
    if (value == null || def.dv == null) return [];
    return [{ key, label: def.label, value, unit: def.unit, pct: percentDv(key, value) ?? 0, limit: !!def.limit }];
  });
  const shownMicros = showAll ? microRows : microRows.slice(0, 10);

  const chips: [string, number][] = [];
  if (serving) chips.push([`${food.serving_name ?? t("serving")} · ${round1(serving)} g`, serving]);
  chips.push(["100 g", 100]);
  if (serving) chips.push([`½ ${food.serving_name ?? t("serving")}`, round1(serving / 2)]);

  function add() {
    if (!(grams > 0)) return;
    setError(null);
    const fd = new FormData();
    fd.set("food_id", food.id);
    fd.set("meal", meal);
    fd.set("entry_date", localDate(new Date()));
    fd.set("grams", String(grams));
    startTransition(async () => {
      try {
        const res = await addDiaryEntry(fd);
        if (res?.error) {
          setError(res.error);
          return;
        }
        track("diary_entry_logged", { kind: "food" });
      } catch {
        enqueue("food", Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)])));
      }
      router.push("/dashboard");
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8">
      <section className="flex flex-col gap-3.5 rounded-[20px] border border-ink-800 bg-ink-900 p-4 lg:gap-3.5 lg:rounded-3xl lg:p-[22px]">
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-display text-[15px] font-semibold text-paper max-lg:sr-only">{t("portion")}</h2>
          <output
            aria-live="polite"
            className="text-grad font-mono text-[52px] leading-none font-semibold tracking-[-0.05em] tabular max-lg:mx-auto lg:text-[60px]"
          >
            {grams}
            <span className="text-lg lg:text-xl"> g</span>
          </output>
        </div>
        <input
          type="range"
          min={0}
          max={max}
          step={1}
          value={grams}
          onChange={(e) => setGrams(Number(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault();
              setGrams((g) => Math.min(max, Math.max(0, g + (e.key === "ArrowUp" ? STEP : -STEP))));
            }
          }}
          aria-label={t("gramsLabel")}
          className="h-11 w-full cursor-pointer"
        />
        <div className="flex flex-wrap items-center justify-center gap-1.5 lg:justify-start lg:gap-2">
          {chips.map(([label, value]) => (
            <button
              key={label}
              type="button"
              onClick={() => setGrams(value)}
              aria-pressed={grams === value}
              className={`btn-press min-h-9 rounded-full border px-3 text-xs lg:text-[13px] ${
                grams === value ? "border-flame/50 text-flame" : "border-ink-700 text-paper-dim hover:text-paper"
              }`}
            >
              {label}
            </button>
          ))}
          <span className="ms-1.5 text-xs text-paper-mute max-lg:hidden">{t("arrowHint")}</span>
        </div>

        <dl className="grid grid-cols-4 gap-1.5 text-center lg:gap-2.5 lg:text-start">
          {(
            [
              ["kcal", Math.round(m.kcal), "text-paper"],
              [t("protein"), round1(m.protein), "text-protein"],
              [t("carbs"), round1(m.carbs), "text-carbs"],
              [t("fat"), round1(m.fat), "text-fat"],
            ] as const
          ).map(([label, value, color]) => (
            <div key={label} className="rounded-xl border border-ink-800 bg-ink-950 px-1 py-2 lg:rounded-[14px] lg:p-3">
              <dd className={`font-mono text-[15px] font-medium tabular lg:text-[22px] ${color}`}>{value}</dd>
              <dt className="text-[10px] text-paper-mute lg:order-first lg:text-[11px]">{label}</dt>
            </div>
          ))}
        </dl>

        <div className="flex flex-wrap items-center gap-2.5">
          <label className="relative">
            <span className="sr-only">{t("meal")}</span>
            <select
              value={meal}
              onChange={(e) => setMealChoice(e.target.value as MealType)}
              className="min-h-12 cursor-pointer appearance-none rounded-xl border border-ink-700 bg-transparent ps-3.5 pe-8 text-sm text-paper-dim outline-none focus:border-flame/50"
            >
              {MEAL_TYPES.map((mt) => (
                <option key={mt} value={mt} className="bg-ink-900">
                  {tm(mt)}
                </option>
              ))}
            </select>
            <CaretDown
              weight="bold"
              aria-hidden
              className="pointer-events-none absolute end-3 top-1/2 size-3.5 -translate-y-1/2 text-paper-mute"
            />
          </label>
          <button
            type="button"
            onClick={add}
            disabled={pending || !(grams > 0)}
            className="btn-flame btn-press min-h-12 flex-1 rounded-xl px-5 text-sm disabled:opacity-40"
          >
            {pending ? t("adding") : t("addToOrbit")}
          </button>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
      </section>

      <section className="flex flex-col gap-2.5 self-start rounded-[20px] border border-ink-800 bg-ink-900 p-4 lg:mt-0 lg:rounded-3xl lg:p-5">
        <div>
          <h2 className="font-display text-[15px] font-semibold text-paper">{t("micros")}</h2>
          <p className="text-xs text-paper-mute">{t("microsHint")}</p>
        </div>
        {microRows.length === 0 ? (
          <p className="text-sm text-paper-mute">{t("noMicros")}</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {shownMicros.map((row) => {
              const bad = row.limit ? row.pct >= 100 : row.pct < LOW_DV_PCT;
              return (
                <li key={row.key} className="grid grid-cols-[96px_minmax(0,1fr)_48px] items-center gap-2.5 text-[13px]">
                  <span className="truncate text-paper-dim" title={`${formatAmount(row.value)} ${row.unit}`}>
                    {row.label}
                  </span>
                  <span className="h-[5px] overflow-hidden rounded-full bg-ink-800">
                    <span
                      className={`block h-full rounded-full ${bad ? "bg-danger" : "bg-fibre"}`}
                      style={{ width: `${Math.min(row.pct, 100)}%` }}
                    />
                  </span>
                  <span className={`text-end font-mono text-[11px] tabular ${bad ? "text-danger" : "text-paper-dim"}`}>
                    {row.pct}%
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {microRows.length > 10 && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="min-h-9 border-t border-ink-800 pt-2.5 text-start text-xs text-paper-mute hover:text-paper"
          >
            {showAll ? t("showFewer") : t("showAll", { count: microRows.length })}
          </button>
        )}
      </section>
    </div>
  );
}
