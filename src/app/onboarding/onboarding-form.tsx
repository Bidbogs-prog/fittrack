"use client";

import { useState } from "react";
import { GenderFemale, GenderMale } from "@phosphor-icons/react";
import {
  ACTIVITY_LEVELS,
  GOALS,
  MACRO_PCT_MAX,
  MACRO_PCT_MIN,
  MACRO_PRESETS,
  ageFromBirthDate,
  calcBmr,
  calcTargets,
  calcTdee,
  macroSplitFromProfile,
  type MacroSplit,
} from "@/lib/nutrition";
import { Reveal } from "@/components/motion/reveal";
import type { ActivityLevel, Gender, Goal, Profile } from "@/lib/types";
import { completeOnboarding } from "./actions";

const LEVEL_KEYS = Object.keys(ACTIVITY_LEVELS) as ActivityLevel[];
const GOAL_KEYS = Object.keys(GOALS) as Goal[];

type MacroMode = "auto" | (typeof MACRO_PRESETS)[number]["key"] | "custom";

const sameSplit = (a: MacroSplit, b: MacroSplit) =>
  a.protein === b.protein && a.carbs === b.carbs && a.fat === b.fat;

export function OnboardingForm({ profile }: { profile?: Profile | null }) {
  const [gender, setGender] = useState<Gender | null>(profile?.gender ?? null);
  const [birthDate, setBirthDate] = useState(profile?.birth_date ?? "");
  const [height, setHeight] = useState(profile?.height_cm ? String(profile.height_cm) : "");
  const [weight, setWeight] = useState(profile?.weight_kg ? String(profile.weight_kg) : "");
  const [activity, setActivity] = useState<ActivityLevel | null>(profile?.activity_level ?? null);
  const [goal, setGoal] = useState<Goal | null>(profile?.goal ?? null);
  const [submitting, setSubmitting] = useState(false);

  const savedSplit = profile ? macroSplitFromProfile(profile) : null;
  const [macroMode, setMacroMode] = useState<MacroMode>(
    savedSplit
      ? (MACRO_PRESETS.find((p) => sameSplit(p.split, savedSplit))?.key ?? "custom")
      : "auto"
  );
  const [custom, setCustom] = useState<MacroSplit>(
    savedSplit ?? { protein: 30, carbs: 40, fat: 30 }
  );

  const activeSplit: MacroSplit | null =
    macroMode === "auto"
      ? null
      : macroMode === "custom"
        ? custom
        : MACRO_PRESETS.find((p) => p.key === macroMode)!.split;

  const customSum = custom.protein + custom.carbs + custom.fat;
  const customValid =
    customSum === 100 &&
    [custom.protein, custom.carbs, custom.fat].every(
      (v) => Number.isInteger(v) && v >= MACRO_PCT_MIN && v <= MACRO_PCT_MAX
    );

  // Cheap enough to derive on every render; keeps the macro math in one place.
  const preview = (() => {
    const h = Number(height);
    const w = Number(weight);
    if (!gender || !birthDate || !(h > 0) || !(w > 0)) return null;
    const age = ageFromBirthDate(birthDate);
    if (age < 13 || age > 100) return null;
    const bmr = calcBmr(gender, w, h, age);
    const tdee = activity ? calcTdee(bmr, activity) : null;
    const target =
      tdee !== null && goal ? Math.max(1200, tdee + GOALS[goal].kcalDelta) : null;
    // Full targets (incl. macro grams) via the single source of truth.
    const targets =
      activity && goal && (macroMode !== "custom" || customValid)
        ? calcTargets({
            id: "",
            email: null,
            full_name: null,
            gender,
            birth_date: birthDate,
            height_cm: h,
            weight_kg: w,
            activity_level: activity,
            goal,
            protein_pct: activeSplit?.protein ?? null,
            carbs_pct: activeSplit?.carbs ?? null,
            fat_pct: activeSplit?.fat ?? null,
            eating_window_start: null,
            eating_window_end: null,
            onboarded: true,
          })
        : null;
    return { bmr, tdee, target, targets };
  })();

  const complete =
    Boolean(gender && birthDate && height && weight && activity && goal) &&
    preview !== null &&
    (macroMode !== "custom" || customValid);

  return (
    <form action={completeOnboarding} onSubmit={() => setSubmitting(true)}>
      <Reveal
        onScroll={false}
        delay={0.25}
        stagger={0.12}
        className="mt-10 grid gap-8 md:grid-cols-[1fr_300px] lg:grid-cols-[1fr_320px] lg:gap-10"
      >
      <div className="space-y-10">
        {/* 01 — body */}
        <section data-reveal>
          <h2 className="flex items-baseline gap-3 font-display text-lg font-semibold text-paper">
            <span className="font-mono text-xs text-lime">01</span> Your body
          </h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <fieldset className="sm:col-span-2">
              <legend className="field-label mb-2">Biological sex (for the BMR formula)</legend>
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    ["male", "Male", GenderMale],
                    ["female", "Female", GenderFemale],
                  ] as const
                ).map(([value, label, Icon]) => (
                  <label
                    key={value}
                    className={`btn-press flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3.5 transition-colors ${
                      gender === value
                        ? "border-lime/60 bg-lime/[0.08] text-paper"
                        : "border-ink-700 bg-ink-900 text-paper-dim hover:border-ink-600"
                    }`}
                  >
                    <input
                      type="radio"
                      name="gender"
                      value={value}
                      required
                      checked={gender === value}
                      onChange={() => setGender(value)}
                      className="sr-only"
                    />
                    <Icon weight="bold" className={`size-5 ${gender === value ? "text-lime" : ""}`} />
                    <span className="text-sm font-medium">{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="space-y-2">
              <label htmlFor="birth_date" className="field-label">Date of birth</label>
              <input
                id="birth_date"
                name="birth_date"
                type="date"
                required
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="field [color-scheme:dark]"
              />
              <p className="text-xs text-paper-mute">Age is part of the BMR equation.</p>
            </div>
            <div className="grid gap-4 min-[400px]:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="height_cm" className="field-label">Height (cm)</label>
                <input
                  id="height_cm"
                  name="height_cm"
                  type="number"
                  inputMode="decimal"
                  min={90}
                  max={260}
                  step="0.1"
                  required
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="178"
                  className="field tabular"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="weight_kg" className="field-label">Weight (kg)</label>
                <input
                  id="weight_kg"
                  name="weight_kg"
                  type="number"
                  inputMode="decimal"
                  min={25}
                  max={400}
                  step="0.1"
                  required
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="80"
                  className="field tabular"
                />
              </div>
            </div>
          </div>
        </section>

        {/* 02 — training */}
        <section data-reveal>
          <h2 className="flex items-baseline gap-3 font-display text-lg font-semibold text-paper">
            <span className="font-mono text-xs text-lime">02</span> Training frequency
          </h2>
          <p className="mt-1 text-xs text-paper-mute">Sets the TDEE multiplier.</p>
          <div className="mt-5 grid gap-3">
            {LEVEL_KEYS.map((key) => {
              const { label, detail, multiplier } = ACTIVITY_LEVELS[key];
              const selected = activity === key;
              return (
                <label
                  key={key}
                  className={`btn-press flex cursor-pointer items-center justify-between gap-4 rounded-xl border px-4 py-3.5 transition-colors ${
                    selected
                      ? "border-lime/60 bg-lime/[0.08]"
                      : "border-ink-700 bg-ink-900 hover:border-ink-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="activity_level"
                    value={key}
                    required
                    checked={selected}
                    onChange={() => setActivity(key)}
                    className="sr-only"
                  />
                  <span className="min-w-0">
                    <span className={`block text-sm font-medium ${selected ? "text-paper" : "text-paper-dim"}`}>
                      {label}
                    </span>
                    <span className="mt-0.5 block text-xs text-paper-mute">{detail}</span>
                  </span>
                  <span
                    className={`shrink-0 rounded-md px-2 py-1 font-mono text-xs tabular ${
                      selected ? "bg-lime text-lime-ink" : "bg-ink-800 text-paper-mute"
                    }`}
                  >
                    ×{multiplier}
                  </span>
                </label>
              );
            })}
          </div>
        </section>

        {/* 03 — goal */}
        <section data-reveal>
          <h2 className="flex items-baseline gap-3 font-display text-lg font-semibold text-paper">
            <span className="font-mono text-xs text-lime">03</span> Your goal
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {GOAL_KEYS.map((key) => {
              const { label, detail } = GOALS[key];
              const selected = goal === key;
              return (
                <label
                  key={key}
                  className={`btn-press cursor-pointer rounded-xl border px-4 py-4 transition-colors ${
                    selected
                      ? "border-lime/60 bg-lime/[0.08]"
                      : "border-ink-700 bg-ink-900 hover:border-ink-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="goal"
                    value={key}
                    required
                    checked={selected}
                    onChange={() => setGoal(key)}
                    className="sr-only"
                  />
                  <span className={`block font-display text-sm font-semibold ${selected ? "text-lime" : "text-paper"}`}>
                    {label}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-paper-mute">{detail}</span>
                </label>
              );
            })}
          </div>
        </section>

        {/* 04 — macro split */}
        <section data-reveal>
          <h2 className="flex items-baseline gap-3 font-display text-lg font-semibold text-paper">
            <span className="font-mono text-xs text-lime">04</span> Macro split
          </h2>
          <p className="mt-1 text-xs text-paper-mute">
            How your calories divide into protein, carbs and fat. Pick what suits how you like to
            eat — you can change it any time.
          </p>

          <input type="hidden" name="macro_mode" value={macroMode === "auto" ? "auto" : "custom"} />
          {macroMode !== "auto" && macroMode !== "custom" && activeSplit && (
            <>
              <input type="hidden" name="protein_pct" value={activeSplit.protein} />
              <input type="hidden" name="carbs_pct" value={activeSplit.carbs} />
              <input type="hidden" name="fat_pct" value={activeSplit.fat} />
            </>
          )}

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label
              className={`btn-press cursor-pointer rounded-xl border px-4 py-4 transition-colors sm:col-span-2 ${
                macroMode === "auto"
                  ? "border-lime/60 bg-lime/[0.08]"
                  : "border-ink-700 bg-ink-900 hover:border-ink-600"
              }`}
            >
              <input
                type="radio"
                name="macro_mode_choice"
                checked={macroMode === "auto"}
                onChange={() => setMacroMode("auto")}
                className="sr-only"
              />
              <span className={`block font-display text-sm font-semibold ${macroMode === "auto" ? "text-lime" : "text-paper"}`}>
                Coach formula
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-paper-mute">
                Protein pinned to your bodyweight ({goal ? GOALS[goal].proteinPerKg : "1.8–2.2"} g/kg
                for your goal), fat at 25% of calories, carbs fill the rest. Protein-forward — heavier
                than some people want.
              </span>
            </label>

            {MACRO_PRESETS.map(({ key, label, detail, split }) => {
              const selected = macroMode === key;
              return (
                <label
                  key={key}
                  className={`btn-press cursor-pointer rounded-xl border px-4 py-4 transition-colors ${
                    selected
                      ? "border-lime/60 bg-lime/[0.08]"
                      : "border-ink-700 bg-ink-900 hover:border-ink-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="macro_mode_choice"
                    checked={selected}
                    onChange={() => setMacroMode(key)}
                    className="sr-only"
                  />
                  <span className="flex items-center justify-between gap-2">
                    <span className={`font-display text-sm font-semibold ${selected ? "text-lime" : "text-paper"}`}>
                      {label}
                    </span>
                    <span className={`rounded-md px-2 py-1 font-mono text-[11px] tabular ${selected ? "bg-lime text-lime-ink" : "bg-ink-800 text-paper-mute"}`}>
                      {split.protein}·{split.carbs}·{split.fat}
                    </span>
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-paper-mute">{detail}</span>
                </label>
              );
            })}

            <label
              className={`btn-press cursor-pointer rounded-xl border px-4 py-4 transition-colors ${
                macroMode === "custom"
                  ? "border-lime/60 bg-lime/[0.08]"
                  : "border-ink-700 bg-ink-900 hover:border-ink-600"
              }`}
            >
              <input
                type="radio"
                name="macro_mode_choice"
                checked={macroMode === "custom"}
                onChange={() => setMacroMode("custom")}
                className="sr-only"
              />
              <span className={`block font-display text-sm font-semibold ${macroMode === "custom" ? "text-lime" : "text-paper"}`}>
                Custom
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-paper-mute">
                Set your own percentages — they just need to total 100.
              </span>
            </label>
          </div>

          {macroMode === "custom" && (
            <div className="mt-4 rounded-xl border border-ink-700 bg-ink-900 p-4">
              <div className="grid grid-cols-3 gap-3">
                {(
                  [
                    ["protein_pct", "Protein", "protein", "bg-protein"],
                    ["carbs_pct", "Carbs", "carbs", "bg-carbs"],
                    ["fat_pct", "Fat", "fat", "bg-fat"],
                  ] as const
                ).map(([name, label, key, dot]) => (
                  <div key={key} className="space-y-2">
                    <label htmlFor={name} className="field-label flex items-center gap-1.5">
                      <span className={`size-2 rounded-full ${dot}`} aria-hidden />
                      {label} %
                    </label>
                    <input
                      id={name}
                      name={name}
                      type="number"
                      inputMode="numeric"
                      min={MACRO_PCT_MIN}
                      max={MACRO_PCT_MAX}
                      step={1}
                      required
                      value={custom[key]}
                      onChange={(e) =>
                        setCustom((c) => ({ ...c, [key]: Math.round(Number(e.target.value)) }))
                      }
                      className="field tabular"
                    />
                  </div>
                ))}
              </div>
              <p
                className={`mt-3 font-mono text-xs tabular ${
                  customValid ? "text-lime" : "text-danger"
                }`}
                role={customValid ? undefined : "alert"}
              >
                {customValid
                  ? "Adds up to 100% — you're set."
                  : `Currently ${customSum}% — the three must total 100% (${MACRO_PCT_MIN}–${MACRO_PCT_MAX}% each).`}
              </p>
            </div>
          )}
        </section>
      </div>

      {/* live preview panel */}
      <aside data-reveal className="md:sticky md:top-8 md:self-start">
        <div className="rounded-2xl border border-ink-700 bg-ink-900/80 p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-paper-mute">
            Your numbers
          </p>
          <dl className="mt-5 space-y-5">
            <div>
              <dt className="text-xs text-paper-mute">BMR — resting burn</dt>
              <dd className="mt-1 font-mono text-3xl font-semibold tracking-tight text-paper tabular">
                {preview ? preview.bmr.toLocaleString() : "—"}
                <span className="ml-1 text-sm text-paper-mute">kcal</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-paper-mute">TDEE — daily burn with training</dt>
              <dd className="mt-1 font-mono text-3xl font-semibold tracking-tight text-paper tabular">
                {preview?.tdee ? preview.tdee.toLocaleString() : "—"}
                <span className="ml-1 text-sm text-paper-mute">kcal</span>
              </dd>
            </div>
            <div className="rounded-xl bg-lime/[0.08] px-4 py-3.5 ring-1 ring-inset ring-lime/25">
              <dt className="text-xs font-medium text-lime">Daily target</dt>
              <dd className="mt-1 font-mono text-3xl font-semibold tracking-tight text-lime tabular">
                {preview?.target ? preview.target.toLocaleString() : "—"}
                <span className="ml-1 text-sm opacity-70">kcal</span>
              </dd>
            </div>
            {preview?.targets && (
              <div>
                <dt className="text-xs text-paper-mute">Daily macros</dt>
                <dd className="mt-2 grid grid-cols-3 divide-x divide-ink-700 border-y border-ink-700">
                  {(
                    [
                      ["Protein", preview.targets.protein, "bg-protein"],
                      ["Carbs", preview.targets.carbs, "bg-carbs"],
                      ["Fat", preview.targets.fat, "bg-fat"],
                    ] as const
                  ).map(([label, grams, dot]) => (
                    <div key={label} className="px-3 py-2.5 first:pl-0">
                      <p className="flex items-center gap-1.5 text-[11px] text-paper-mute">
                        <span className={`size-1.5 rounded-full ${dot}`} aria-hidden />
                        {label}
                      </p>
                      <p className="mt-0.5 font-mono text-base font-semibold text-paper tabular">
                        {grams}
                        <span className="ml-0.5 text-xs text-paper-mute">g</span>
                      </p>
                    </div>
                  ))}
                </dd>
              </div>
            )}
          </dl>
          <button
            type="submit"
            disabled={!complete || submitting}
            className="btn-press mt-6 w-full rounded-xl bg-lime px-5 py-3 font-display text-sm font-bold uppercase tracking-wide text-lime-ink transition-opacity hover:bg-lime-deep disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Saving…" : "Lock in my targets"}
          </button>
          <p className="mt-3 text-center text-xs text-paper-mute">
            {complete
              ? "You can change all of this later."
              : "Complete all three sections to unlock."}
          </p>
        </div>
      </aside>
      </Reveal>
    </form>
  );
}
