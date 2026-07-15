"use client";

import { useMemo, useState } from "react";
import { GenderFemale, GenderMale } from "@phosphor-icons/react";
import {
  ACTIVITY_LEVELS,
  GOALS,
  ageFromBirthDate,
  calcBmr,
  calcTdee,
} from "@/lib/nutrition";
import { Reveal } from "@/components/motion/reveal";
import type { ActivityLevel, Gender, Goal, Profile } from "@/lib/types";
import { completeOnboarding } from "./actions";

const LEVEL_KEYS = Object.keys(ACTIVITY_LEVELS) as ActivityLevel[];
const GOAL_KEYS = Object.keys(GOALS) as Goal[];

export function OnboardingForm({ profile }: { profile?: Profile | null }) {
  const [gender, setGender] = useState<Gender | null>(profile?.gender ?? null);
  const [birthDate, setBirthDate] = useState(profile?.birth_date ?? "");
  const [height, setHeight] = useState(profile?.height_cm ? String(profile.height_cm) : "");
  const [weight, setWeight] = useState(profile?.weight_kg ? String(profile.weight_kg) : "");
  const [activity, setActivity] = useState<ActivityLevel | null>(profile?.activity_level ?? null);
  const [goal, setGoal] = useState<Goal | null>(profile?.goal ?? null);
  const [submitting, setSubmitting] = useState(false);

  const preview = useMemo(() => {
    const h = Number(height);
    const w = Number(weight);
    if (!gender || !birthDate || !(h > 0) || !(w > 0)) return null;
    const age = ageFromBirthDate(birthDate);
    if (age < 13 || age > 100) return null;
    const bmr = calcBmr(gender, w, h, age);
    const tdee = activity ? calcTdee(bmr, activity) : null;
    const target =
      tdee !== null && goal ? Math.max(1200, tdee + GOALS[goal].kcalDelta) : null;
    return { bmr, tdee, target };
  }, [gender, birthDate, height, weight, activity, goal]);

  const complete =
    Boolean(gender && birthDate && height && weight && activity && goal) && preview !== null;

  return (
    <form action={completeOnboarding} onSubmit={() => setSubmitting(true)}>
      <Reveal
        onScroll={false}
        delay={0.25}
        stagger={0.12}
        className="mt-10 grid gap-10 lg:grid-cols-[1fr_320px]"
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
            <div className="grid grid-cols-2 gap-4">
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
                  <span>
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
      </div>

      {/* live preview panel */}
      <aside data-reveal className="lg:sticky lg:top-8 lg:self-start">
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
          </dl>
          <button
            type="submit"
            disabled={!complete || submitting}
            className="btn-press mt-6 w-full rounded-xl bg-lime px-5 py-3 font-display text-sm font-bold uppercase tracking-wide text-lime-ink transition-opacity hover:bg-lime-deep disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Saving…" : "Lock in my targets"}
          </button>
          <p className="mt-3 text-center text-xs text-paper-mute">
            You can change all of this later.
          </p>
        </div>
      </aside>
      </Reveal>
    </form>
  );
}
