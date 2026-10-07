"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarCheck, Sparkle } from "@phosphor-icons/react";
import { IntentButton } from "@/components/intent-button";
import { ThinkingOrbit } from "@/components/orbit/thinking";
import { track } from "@/lib/analytics";
import { generateCheckin, type Checkin } from "./checkin";

/**
 * Monday check-in card (premium). Generated once per week on the first
 * visit; free users see what it is plus the premium fake door.
 */
export function CheckinCard({ initial, premium }: { initial: Checkin | null; premium: boolean }) {
  const t = useTranslations("checkin");
  const [checkin, setCheckin] = useState<Checkin | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(premium && !initial);
  const started = useRef(false);

  useEffect(() => {
    if (!premium || initial || started.current) return;
    started.current = true;
    generateCheckin()
      .then((res) => {
        if (res.data) {
          setCheckin(res.data);
          track("checkin_generated", { adaptive: res.data.targets.adaptive });
        } else setError(res.error);
      })
      .catch(() => setError(t("failed")))
      .finally(() => setLoading(false));
  }, [premium, initial, t]);

  const shell = "rounded-[20px] border border-flame/30 bg-[linear-gradient(135deg,rgba(255,157,59,.12),rgba(242,112,31,.03))] p-4";
  const header = (
    <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.14em] text-flame uppercase">
      <CalendarCheck weight="fill" className="size-3.5" />
      {t("eyebrow")}
    </p>
  );

  if (!premium) {
    return (
      <section className={shell}>
        {header}
        <p className="mt-2 text-sm leading-relaxed text-paper-dim">{t("teaser")}</p>
        <div className="mt-3">
          <IntentButton
            kind="premium"
            surface="checkin"
            label={t("unlock")}
            doneLabel={t("intentDone")}
            className="btn-press btn-flame inline-flex min-h-9 items-center rounded-lg px-3 text-[13px] font-semibold"
          />
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <section className={shell}>
        {header}
        <ThinkingOrbit className="mt-3" size={26} steps={[t("thinking1"), t("thinking2"), t("thinking3")]} />
      </section>
    );
  }

  if (!checkin) {
    return (
      <section className={shell}>
        {header}
        <p className="mt-2 text-sm text-paper-dim">{error && error.length < 40 && !error.includes(" ") ? t("failed") : (error ?? t("failed"))}</p>
      </section>
    );
  }

  const delta = checkin.previous ? checkin.targets.kcal - checkin.previous.kcal : null;
  return (
    <section className={shell} aria-label={t("eyebrow")}>
      {header}
      <h2 dir="auto" className="mt-2 font-display text-base leading-snug font-semibold text-paper">
        {checkin.headline}
      </h2>
      <p dir="auto" className="mt-1.5 text-[13px] leading-relaxed text-paper-dim">
        {checkin.review}
      </p>
      {checkin.wins.length > 0 && (
        <ul className="mt-2 space-y-1">
          {checkin.wins.map((w) => (
            <li key={w} dir="auto" className="flex gap-1.5 text-[13px] text-paper-dim">
              <Sparkle weight="fill" className="mt-0.5 size-3.5 shrink-0 text-flame" />
              {w}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 rounded-xl border border-ink-800 bg-ink-950/50 px-3 py-2.5">
        <p className="flex items-baseline justify-between gap-2 font-mono text-[13px] text-paper tabular">
          <span>
            {checkin.targets.kcal} kcal · P {checkin.targets.protein} g
          </span>
          {delta != null && delta !== 0 && (
            <span className={`text-xs ${delta < 0 ? "text-fibre" : "text-flame"}`}>
              {delta > 0 ? "+" : "−"}
              {Math.abs(delta)} kcal
            </span>
          )}
        </p>
        <p dir="auto" className="mt-1 text-xs leading-relaxed text-paper-mute">
          {checkin.targetNote}
        </p>
      </div>
      <p dir="auto" className="mt-3 text-[13px] text-paper">
        <span className="font-semibold text-flame">{t("focus")}</span> {checkin.focus}
      </p>
      <Link
        href={`/coach?c=new&q=${encodeURIComponent(t("discussPrompt", { focus: checkin.focus }))}`}
        className="mt-2 inline-flex min-h-9 items-center text-[13px] font-medium text-flame hover:text-flame-glow"
      >
        {t("discuss")} <span aria-hidden className="ms-1 rtl:-scale-x-100">→</span>
      </Link>
    </section>
  );
}
