"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Minus, Plus } from "@phosphor-icons/react";
import { Logo } from "@/components/logo";
import { Orbit } from "@/components/orbit/orbit";
import {
  ACTIVITY_LEVELS,
  GOALS,
  KCAL_FLOOR,
  ageFromBirthDate,
  calcBmr,
  calcTargets,
  calcTdee,
  macroSplitFromProfile,
} from "@/lib/nutrition";
import { displayWeight, formatHeight } from "@/lib/units";
import type { ActivityLevel, Gender, Goal, Profile, Units } from "@/lib/types";
import { completeOnboarding } from "./actions";

const LEVEL_KEYS = Object.keys(ACTIVITY_LEVELS) as ActivityLevel[];
const GOAL_KEYS = Object.keys(GOALS) as Goal[];
const STEPS = 6;
const MIN_AGE = 14;
const MAX_AGE = 80;

/** A birth date `years` ago, keeping the month/day of `base` when given. */
function birthDateForAge(years: number, base: string | null): string {
  const today = new Date();
  const [, m, d] = (base ?? "").split("-").map(Number);
  const month = m ? m - 1 : today.getMonth();
  const day = d || today.getDate();
  let y = today.getFullYear() - years;
  // Birthday still to come this year: one year earlier keeps the age exact.
  if (month > today.getMonth() || (month === today.getMonth() && day > today.getDate())) y -= 1;
  return `${y}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const selectCls = (on: boolean) =>
  `btn-press cursor-pointer border transition-[border-color,background-color] duration-300 ease-[var(--ease-ui)] ${
    on ? "border-flame bg-flame/[0.08]" : "border-ink-800 bg-ink-900 hover:border-ink-700"
  }`;

/**
 * Six-step setup (sex, age, body, training, goal, ready) beside a live
 * orbit that fills in as the numbers arrive. Every figure comes from
 * nutrition.ts — calcBmr/calcTdee for the strip, calcTargets for the macros.
 */
export function OnboardingForm({ profile }: { profile?: Profile | null }) {
  const t = useTranslations("onboarding");
  const format = useFormatter();
  const [step, setStep] = useState(0);
  const [gender, setGender] = useState<Gender | null>(profile?.gender ?? null);
  const [birthDate, setBirthDate] = useState(profile?.birth_date ?? birthDateForAge(30, null));
  const [height, setHeight] = useState(profile?.height_cm ?? 172);
  const [weight, setWeight] = useState(profile?.weight_kg ?? 72);
  const [units, setUnits] = useState<Units>(profile?.units ?? "metric");
  const [activity, setActivity] = useState<ActivityLevel>(profile?.activity_level ?? "moderate");
  const [goal, setGoal] = useState<Goal>(profile?.goal ?? "maintain");
  const hadWindow = profile?.eating_window_start != null;
  const [windowOn, setWindowOn] = useState(hadWindow);
  const [submitting, setSubmitting] = useState(false);

  const age = ageFromBirthDate(birthDate);
  const split = profile ? macroSplitFromProfile(profile) : null;

  const bmr = gender ? calcBmr(gender, weight, height, age) : null;
  const tdee = bmr != null ? calcTdee(bmr, activity) : null;
  const targets = gender
    ? calcTargets({
        id: "",
        email: null,
        full_name: null,
        gender,
        birth_date: birthDate,
        height_cm: height,
        weight_kg: weight,
        activity_level: activity,
        goal,
        protein_pct: split?.protein ?? null,
        carbs_pct: split?.carbs ?? null,
        fat_pct: split?.fat ?? null,
        eating_window_start: null,
        eating_window_end: null,
        units: "metric",
        onboarded: true,
      })
    : null;

  // The orbit fills as the steps advance.
  const k = step >= STEPS - 1 ? 1 : step / (STEPS - 1);
  const rings: [number, number, number] = targets
    ? [
        (k * targets.protein * 4) / targets.kcal,
        (k * targets.carbs * 4) / targets.kcal,
        (k * targets.fat * 9) / targets.kcal,
      ]
    : [0, 0, 0];
  const fmt = (n: number) => format.number(n);

  const canContinue = step !== 0 || gender != null;

  const w = displayWeight(weight, units);

  return (
    <form
      action={completeOnboarding}
      onSubmit={(e) => {
        // Only the final step submits; Enter in a field elsewhere must not.
        if (step < STEPS - 1) {
          e.preventDefault();
          return;
        }
        setSubmitting(true);
      }}
      className="contents"
    >
      <input type="hidden" name="gender" value={gender ?? ""} />
      <input type="hidden" name="birth_date" value={birthDate} />
      <input type="hidden" name="height_cm" value={height} />
      <input type="hidden" name="weight_kg" value={weight} />
      <input type="hidden" name="activity_level" value={activity} />
      <input type="hidden" name="goal" value={goal} />
      {/* Keep a saved custom split through an edit. */}
      <input type="hidden" name="macro_mode" value={split ? "custom" : "auto"} />
      {split && (
        <>
          <input type="hidden" name="protein_pct" value={split.protein} />
          <input type="hidden" name="carbs_pct" value={split.carbs} />
          <input type="hidden" name="fat_pct" value={split.fat} />
        </>
      )}
      {windowOn !== hadWindow && <input type="hidden" name="window_mode" value={windowOn ? "on" : "off"} />}

      {/* logo + progress */}
      <header className="mx-auto flex w-full max-w-[1160px] items-center gap-5 px-6 py-[18px]">
        <Logo href={profile ? "/dashboard" : "/"} />
        <div className="ms-auto flex max-w-[420px] flex-1 gap-1.5" aria-hidden>
          {Array.from({ length: STEPS }, (_, i) => (
            <span
              key={i}
              className="h-1 flex-1 rounded-full transition-[background] duration-500"
              style={{ background: i <= step ? "linear-gradient(90deg,#ffc94d,#f2701f)" : "var(--ink-800)" }}
            />
          ))}
        </div>
        <span className="font-mono text-xs font-medium whitespace-nowrap text-paper-mute" aria-live="polite">
          {t("stepOf", { step: step + 1, total: STEPS })}
        </span>
      </header>

      <div className="mx-auto grid w-full max-w-[1160px] flex-1 grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] items-center gap-12 px-6 pt-6 pb-12">
        <div className="flex min-w-0 flex-col gap-[22px]">
          <div key={step} className="rise-in flex flex-col gap-[18px]">
            <p className="eyebrow">{t(`eyebrow.${step}`)}</p>
            <h1 className="font-display text-[clamp(36px,5vw,56px)] leading-none font-bold tracking-[-0.045em] text-balance text-paper">
              {step === 5 ? t("readyTitle", { kcal: targets ? fmt(targets.kcal) : "—" }) : t(`title.${step}`)}
            </h1>

            {step === 0 && (
              <>
                <p className="text-[15px] leading-relaxed text-paper-dim">{t("sexHint")}</p>
                <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label={t("title.0")}>
                  {(
                    [
                      ["male", "+5"],
                      ["female", "−161"],
                    ] as const
                  ).map(([value, term]) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={gender === value}
                      onClick={() => setGender(value)}
                      className={`${selectCls(gender === value)} rounded-[20px] p-[22px] text-start`}
                    >
                      <span className="block font-display text-xl font-semibold text-paper">{t(value)}</span>
                      <span className="mt-1.5 block font-mono text-xs text-paper-mute">BMR {term}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <div className="flex items-center gap-[18px]">
                  <button
                    type="button"
                    onClick={() => setBirthDate(birthDateForAge(Math.max(MIN_AGE, age - 1), birthDate))}
                    aria-label={t("younger")}
                    className="btn-press grid size-[52px] place-items-center rounded-2xl border border-ink-700 text-paper-dim hover:text-paper"
                  >
                    <Minus weight="bold" className="size-5" />
                  </button>
                  <output className="min-w-[140px] text-center font-mono text-[84px] leading-none font-semibold tracking-[-0.06em] text-paper tabular">
                    {age}
                  </output>
                  <button
                    type="button"
                    onClick={() => setBirthDate(birthDateForAge(Math.min(MAX_AGE, age + 1), birthDate))}
                    aria-label={t("older")}
                    className="btn-press grid size-[52px] place-items-center rounded-2xl border border-ink-700 text-paper-dim hover:text-paper"
                  >
                    <Plus weight="bold" className="size-5" />
                  </button>
                </div>
                <input
                  type="range"
                  min={MIN_AGE}
                  max={MAX_AGE}
                  value={Math.min(MAX_AGE, Math.max(MIN_AGE, age))}
                  onChange={(e) => setBirthDate(birthDateForAge(Number(e.target.value), birthDate))}
                  aria-label={t("title.1")}
                  className="h-11 w-full"
                />
                <label className="flex flex-wrap items-center gap-3 text-[13px] text-paper-mute">
                  {t("dob")}
                  <input
                    type="date"
                    value={birthDate}
                    max={birthDateForAge(MIN_AGE, null)}
                    onChange={(e) => e.target.value && setBirthDate(e.target.value)}
                    className="field w-auto py-2 tabular"
                  />
                </label>
                <p className="text-[13px] leading-relaxed text-paper-mute">
                  {age < 18 ? t("under18") : t("ageHint")}
                </p>
              </>
            )}

            {step === 2 && (
              <>
                {(
                  [
                    [t("height"), formatHeight(height, units), height, 140, 210, 1, setHeight, ""],
                    [t("weight"), String(w), weight, 40, 160, 0.5, setWeight, units === "imperial" ? "lb" : "kg"],
                  ] as const
                ).map(([label, shown, value, min, max, stepSize, set, unit]) => (
                  <div key={label} className="flex flex-col gap-2.5 rounded-[22px] border border-ink-800 bg-ink-900 p-5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm text-paper-dim">{label}</span>
                      <span className="font-mono text-[34px] font-semibold tracking-[-0.04em] text-paper tabular">
                        {shown}
                        {unit && <span className="text-sm text-paper-mute"> {unit}</span>}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={min}
                      max={max}
                      step={stepSize}
                      value={value}
                      onChange={(e) => set(Number(e.target.value))}
                      aria-label={label}
                      className="h-11 w-full"
                    />
                  </div>
                ))}
                <div className="flex flex-wrap items-center gap-1.5 text-[13px]" role="radiogroup" aria-label={t("units")}>
                  {(["metric", "imperial"] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      role="radio"
                      aria-checked={units === u}
                      onClick={() => setUnits(u)}
                      className={`min-h-9 rounded-full px-3 ${
                        units === u ? "bg-ink-800 text-paper" : "border border-ink-700 text-paper-mute hover:text-paper"
                      }`}
                    >
                      {t(u)}
                    </button>
                  ))}
                  <span className="px-1 text-paper-mute">{t("unitsHint")}</span>
                </div>
              </>
            )}

            {step === 3 && (
              <div className="flex flex-col gap-2" role="radiogroup" aria-label={t("title.3")}>
                {LEVEL_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={activity === key}
                    onClick={() => setActivity(key)}
                    className={`${selectCls(activity === key)} flex min-h-14 items-center justify-between rounded-2xl px-[18px] py-3.5 text-start`}
                  >
                    <span>
                      <span className="block font-display text-base font-semibold text-paper">{t(`level.${key}.label`)}</span>
                      <span className="block text-xs text-paper-mute">{t(`level.${key}.detail`)}</span>
                    </span>
                    <span className={`font-mono text-[13px] font-medium ${activity === key ? "text-flame" : "text-paper-mute"}`}>
                      × {ACTIVITY_LEVELS[key].multiplier}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {step === 4 && (
              <div className="grid gap-2.5 sm:grid-cols-3" role="radiogroup" aria-label={t("title.4")}>
                {GOAL_KEYS.map((key) => {
                  const delta = GOALS[key].kcalDelta;
                  return (
                    <button
                      key={key}
                      type="button"
                      role="radio"
                      aria-checked={goal === key}
                      onClick={() => setGoal(key)}
                      className={`${selectCls(goal === key)} flex flex-col gap-1.5 rounded-[20px] p-[18px] text-start`}
                    >
                      <span className="font-display text-lg font-semibold text-paper">{t(`goal.${key}.label`)}</span>
                      <span className={`font-mono text-[13px] font-medium ${goal === key ? "text-flame" : "text-paper-mute"}`}>
                        {delta > 0 ? `+${delta}` : delta < 0 ? `−${Math.abs(delta)}` : "± 0"} kcal
                      </span>
                      <span className="text-xs leading-snug text-paper-mute">{t(`goal.${key}.detail`)}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {step === 5 && (
              <>
                <p className="max-w-[46ch] text-[15px] leading-relaxed text-paper-dim">{t("readyBody")}</p>
                <dl className="grid grid-cols-3 gap-2.5">
                  {(
                    [
                      [t("protein"), targets?.protein, "text-protein"],
                      [t("carbs"), targets?.carbs, "text-carbs"],
                      [t("fat"), targets?.fat, "text-fat"],
                    ] as const
                  ).map(([label, value, color]) => (
                    <div key={label} className="rounded-2xl border border-ink-800 bg-ink-900 p-3.5">
                      <dt className="text-xs text-paper-mute">{label}</dt>
                      <dd className={`font-mono text-[22px] font-medium tabular ${color}`}>{value ?? "—"} g</dd>
                    </div>
                  ))}
                </dl>
                {targets && age < 18 && <p className="text-[13px] text-paper-mute">{t("under18")}</p>}
                <button
                  type="button"
                  role="switch"
                  aria-checked={windowOn}
                  onClick={() => setWindowOn((v) => !v)}
                  className="flex min-h-14 items-center justify-between rounded-2xl border border-ink-800 bg-ink-900 px-[18px] py-3.5 text-start"
                >
                  <span>
                    <span className="block font-display text-[15px] font-semibold text-paper">
                      {t("window")} <span className="font-sans text-xs font-normal text-paper-mute">{t("optional")}</span>
                    </span>
                    <span className="block text-xs text-paper-mute">
                      {windowOn ? (hadWindow ? t("windowKeep") : t("windowOn")) : t("windowOff")}
                    </span>
                  </span>
                  <span
                    aria-hidden
                    className={`relative h-[22px] w-10 shrink-0 rounded-full transition-colors ${windowOn ? "bg-flame" : "bg-ink-700"}`}
                  >
                    <span
                      className={`absolute top-[3px] size-4 rounded-full bg-paper transition-[inset-inline-start] duration-300 ease-[var(--ease-ui)] ${
                        windowOn ? "start-[21px]" : "start-[3px]"
                      }`}
                    />
                  </span>
                </button>
              </>
            )}
          </div>

          <div className="mt-1.5 flex gap-2.5">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="btn-press min-h-12 rounded-[14px] border border-ink-700 px-[22px] text-paper-dim hover:text-paper"
              >
                {t("back")}
              </button>
            )}
            {step < STEPS - 1 ? (
              <button
                type="button"
                onClick={() => canContinue && setStep((s) => s + 1)}
                disabled={!canContinue}
                className="btn-press min-h-12 max-w-[280px] flex-1 rounded-[14px] bg-paper px-[22px] font-semibold text-ink-950 disabled:opacity-40"
              >
                {t("continue")}
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting || !targets}
                className="btn-flame btn-press glow-flame min-h-12 max-w-[320px] flex-1 rounded-[14px] px-[22px] disabled:opacity-40"
              >
                {submitting ? t("saving") : t("lockIn")} <span aria-hidden className="rtl:-scale-x-100">→</span>
              </button>
            )}
          </div>
        </div>

        {/* live panel */}
        <div className="flex w-full max-w-[460px] flex-col items-center gap-[18px] justify-self-center">
          <div className="relative aspect-square w-full max-w-[380px]">
            <div
              aria-hidden
              className="absolute -inset-[8%] rounded-full transition-[background] duration-700"
              style={{ background: `radial-gradient(circle,rgba(255,157,59,${(0.05 + k * 0.12).toFixed(2)}),transparent 62%)` }}
            />
            <Orbit
              key={targets ? "ready" : "empty"}
              rings={rings}
              window={{ startMin: 0, endMin: Math.max(0.04, k) * 1439 }}
              labels={false}
              summary={
                targets ? t("orbitSummary", { kcal: targets.kcal }) : t("orbitEmpty")
              }
              className="size-full"
            >
              <div className="absolute inset-[32%] flex flex-col items-center justify-center rounded-full bg-ink-900 shadow-[inset_0_0_0_1px_var(--ink-700)]">
                <span className="font-mono text-[clamp(26px,4vw,38px)] leading-none font-semibold tracking-[-0.04em] text-paper tabular">
                  {targets ? fmt(targets.kcal) : "—"}
                </span>
                <span className="mt-1 text-[10px] tracking-[0.12em] text-paper-mute uppercase">{t("kcalDay")}</span>
              </div>
            </Orbit>
          </div>
          <dl className="grid w-full grid-cols-3 border-y border-ink-700">
            {(
              [
                ["BMR", bmr != null ? fmt(bmr) : "—", t("restingBurn"), false],
                ["TDEE", tdee != null ? fmt(tdee) : "—", `× ${ACTIVITY_LEVELS[activity].multiplier}`, false],
                [
                  t("target"),
                  targets ? fmt(targets.kcal) : "—",
                  targets && tdee != null && tdee + GOALS[goal].kcalDelta < KCAL_FLOOR
                    ? t("floor", { kcal: KCAL_FLOOR })
                    : t(`goal.${goal}.short`),
                  true,
                ],
              ] as const
            ).map(([label, value, sub, accent], i) => (
              <div key={label} className={`py-3 ${i === 0 ? "pe-3" : i === 1 ? "px-3" : "ps-3"} ${i < 2 ? "border-e border-ink-700" : ""}`}>
                <dt className="text-[10px] font-semibold tracking-[0.14em] text-paper-mute uppercase">{label}</dt>
                <dd className={`font-mono text-xl font-medium tabular ${accent ? "text-flame" : "text-paper"}`}>{value}</dd>
                <dd className="text-[11px] text-paper-mute">{sub}</dd>
              </div>
            ))}
          </dl>
          <p dir="ltr" className="text-center font-mono text-xs leading-relaxed text-paper-mute">
            10×{weight} + 6.25×{height} − 5×{age} {gender === "female" ? "− 161" : gender === "male" ? "+ 5" : "± s"}
          </p>
        </div>
      </div>
    </form>
  );
}
