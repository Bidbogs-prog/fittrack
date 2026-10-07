"use client";

import { ArrowClockwise, ChatCircleText, ForkKnife, Sparkle } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { continueInCoach, generateDayInsights, type DayInsights } from "@/app/(app)/dashboard/insights";
import { IntentButton } from "@/components/intent-button";
import { Reveal } from "@/components/motion/reveal";
import { useLog } from "@/components/orbit/log-provider";
import { ThinkingOrbit } from "@/components/orbit/thinking";
import { track } from "@/lib/analytics";

const KIND_DOT: Record<DayInsights["insights"][number]["kind"], string> = {
  win: "bg-flame",
  watch: "bg-danger",
  tip: "bg-carbs",
};

/**
 * The coach's read of one day: a one-line verdict, up to three notes and —
 * for premium users on today — the next meal from their own foods, which
 * logs in one tap through the normal confirm sheet. "Continue in coach"
 * opens a chat that starts from this read. Persisted (ai_insights) and
 * hydrated via `initial`; mount with key={date}.
 */
export function AiInsights({
  date,
  hasEntries,
  isToday,
  premium,
  initial = null,
  generatedAt = null,
}: {
  date: string;
  hasEntries: boolean;
  isToday: boolean;
  premium: boolean;
  initial?: DayInsights | null;
  generatedAt?: string | null;
}) {
  const t = useTranslations("insights");
  const tMeals = useTranslations("meals");
  const tCommon = useTranslations("common");
  const format = useFormatter();
  const router = useRouter();
  const log = useLog();
  const [result, setResult] = useState<DayInsights | null>(initial);
  const [isFresh, setIsFresh] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [opening, startOpening] = useTransition();

  const run = () => {
    setError(null);
    startTransition(async () => {
      const res = await generateDayInsights(date);
      if (res.data == null) setError(res.error);
      else {
        setResult(res.data);
        setIsFresh(true);
        track("day_read_generated", { next: !!res.data.next });
      }
    });
  };

  const openInCoach = () =>
    startOpening(async () => {
      const { id } = await continueInCoach(date);
      track("day_read_to_coach", {});
      router.push(id ? `/coach?c=${id}` : "/coach");
    });

  const next = result?.next ?? null;

  return (
    <Reveal as="section" onScroll={false} delay={0.15} className="rounded-2xl border border-ink-800 bg-ink-900/60">
      <header className="flex items-center justify-between gap-3 px-5 pt-4">
        <p className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.14em] text-flame uppercase">
          <Sparkle weight="fill" className="size-3.5" />
          {t("title")}
        </p>
        {result && !isPending && (
          <button
            type="button"
            onClick={run}
            aria-label={t("regenerate")}
            className="btn-press -me-2 rounded-md p-2 text-paper-mute hover:bg-ink-800 hover:text-paper"
          >
            <ArrowClockwise className="size-4" />
          </button>
        )}
      </header>

      <div className="px-5 pt-2 pb-4">
        {isPending ? (
          <ThinkingOrbit className="py-2" size={28} steps={[t("thinking1"), t("thinking2"), t("thinking3")]} />
        ) : result ? (
          <div className="flex flex-col gap-3.5">
            <p dir="auto" className="font-display text-lg leading-snug font-semibold tracking-tight text-paper">
              {result.summary}
            </p>

            <ul className="flex flex-col gap-2">
              {result.insights.map((note, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-paper-dim">
                  <span aria-hidden className={`mt-2 size-1.5 shrink-0 rounded-full ${KIND_DOT[note.kind]}`} />
                  <p dir="auto">
                    <span className="font-medium text-paper">{note.tag}.</span> {note.text}
                  </p>
                </li>
              ))}
            </ul>

            {next && (
              <div className="rounded-xl border border-flame/30 bg-[linear-gradient(135deg,rgba(255,157,59,.10),rgba(242,112,31,.02))] p-3.5">
                <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <span className="flex items-center gap-1.5 text-[13px] font-semibold text-paper">
                    <ForkKnife weight="bold" className="size-3.5 text-flame" />
                    {t("nextTitle", { meal: tMeals(next.meal) })}
                  </span>
                  <span className="font-mono text-xs text-paper-mute tabular">
                    ~{next.kcal} kcal · P {next.protein} g
                  </span>
                </p>
                <p dir="auto" className="mt-1.5 text-sm text-paper">
                  {next.items.map((i) => `${i.name} ${i.grams} g`).join(" · ")}
                </p>
                <p dir="auto" className="mt-1 text-xs leading-relaxed text-paper-mute">
                  {next.why}
                </p>
                {isToday && (
                  <button
                    type="button"
                    disabled={log.parsing}
                    onClick={() => {
                      track("day_read_next_logged", { meal: next.meal });
                      log.submitText(next.items.map((i) => `${i.grams} g ${i.name}`).join(", "));
                    }}
                    className="btn-press btn-flame mt-3 inline-flex min-h-9 items-center rounded-lg px-3.5 text-[13px] font-semibold disabled:opacity-60"
                  >
                    {t("logThis")}
                  </button>
                )}
              </div>
            )}

            {!premium && isToday && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-ink-700 px-3.5 py-3">
                <p className="text-[13px] text-paper-dim">{t("nextTeaser")}</p>
                <IntentButton
                  kind="premium"
                  surface="day_read_next"
                  label={t("unlock")}
                  doneLabel={t("intentDone")}
                  className="btn-press inline-flex min-h-8 items-center rounded-lg border border-flame/50 px-3 text-xs font-semibold text-flame hover:bg-flame/10"
                />
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-ink-800 pt-3">
              <button
                type="button"
                onClick={openInCoach}
                disabled={opening}
                className="inline-flex min-h-9 items-center gap-1.5 text-[13px] font-medium text-flame hover:text-flame-glow disabled:opacity-60"
              >
                <ChatCircleText weight="bold" className="size-4" />
                {t("continueInCoach")}
              </button>
              <p className="text-[11px] text-paper-mute">
                {!isFresh && generatedAt
                  ? `${t("savedOn", {
                      date: format.dateTime(new Date(generatedAt), { day: "numeric", month: "short" }),
                    })} · `
                  : ""}
                {t("disclaimer")}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
            <p
              role={error ? "alert" : undefined}
              className={`max-w-md text-sm ${error ? "text-danger" : "text-paper-dim"}`}
            >
              {error ?? (hasEntries ? (premium && isToday ? t("pitchPremium") : t("pitch")) : t("needsEntries"))}
            </p>
            {hasEntries && (
              <button
                type="button"
                onClick={run}
                className="btn-press rounded-xl btn-flame px-5 py-2.5 text-sm font-semibold"
              >
                {error ? tCommon("retry") : t("analyseDay")}
              </button>
            )}
          </div>
        )}
      </div>
    </Reveal>
  );
}
