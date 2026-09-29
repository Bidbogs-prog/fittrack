"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { PaperPlaneTilt, Sparkle } from "@phosphor-icons/react";
import { cancelPlanRequest, generateAiPlan, requestPlan } from "./actions";

/**
 * The two ways to get a new plan: the AI composes one from library foods
 * (roadmap 1.4), or a human coach builds one (fulfilled from
 * /admin/requests). Each opens its own small panel.
 */
export function PlanTools({
  pendingRequestId,
  layout = "row",
}: {
  pendingRequestId: string | null;
  layout?: "row" | "grid";
}) {
  const t = useTranslations("plans");
  const [panel, setPanel] = useState<null | "ai" | "coach">(null);
  const [preferences, setPreferences] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function generate() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("preferences", preferences);
      const res = await generateAiPlan(fd);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className={layout === "grid" ? "grid grid-cols-2 gap-2" : "flex flex-wrap gap-2.5"}>
        <button
          type="button"
          onClick={() => setPanel(panel === "ai" ? null : "ai")}
          aria-expanded={panel === "ai"}
          className="btn-tint btn-press inline-flex min-h-11 items-center justify-center gap-2 rounded-[14px] px-4 text-[13px] font-semibold lg:rounded-xl lg:text-sm"
        >
          <Sparkle weight="fill" className="size-4" />
          {t("askAi")}
        </button>
        <button
          type="button"
          onClick={() => setPanel(panel === "coach" ? null : "coach")}
          aria-expanded={panel === "coach"}
          className="btn-press inline-flex min-h-11 items-center justify-center rounded-[14px] border border-ink-700 px-4 text-[13px] text-paper-dim hover:text-paper lg:rounded-xl lg:text-sm"
        >
          {pendingRequestId ? t("requestSent") : t("requestCoach")}
        </button>
      </div>

      {panel === "ai" && (
        <div className="dialog-pop rounded-[20px] border border-flame/25 bg-flame/[0.04] p-4">
          <p className="text-[13px] text-paper-dim">{t("aiHint")}</p>
          <textarea
            value={preferences}
            onChange={(e) => setPreferences(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder={t("aiPlaceholder")}
            className="field mt-3 h-auto resize-none py-3 leading-relaxed"
          />
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
          <button
            type="button"
            onClick={generate}
            disabled={pending}
            className="btn-flame btn-press mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl px-5 text-sm disabled:opacity-40"
          >
            {pending ? t("composing") : t("generate")}
          </button>
        </div>
      )}

      {panel === "coach" && (
        <div className="dialog-pop rounded-[20px] border border-ink-800 bg-ink-900 p-4">
          {pendingRequestId ? (
            <form action={cancelPlanRequest} className="flex flex-wrap items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-[13px] text-paper-dim">
                <PaperPlaneTilt weight="fill" className="size-4 text-flame" />
                {t("requestPending")}
              </p>
              <input type="hidden" name="id" value={pendingRequestId} />
              <button
                type="submit"
                className="btn-press min-h-10 rounded-xl border border-ink-700 px-3.5 text-xs font-semibold text-paper-dim hover:border-danger/50 hover:text-danger"
              >
                {t("cancelRequest")}
              </button>
            </form>
          ) : (
            <form action={requestPlan} className="flex flex-col gap-3">
              <p className="text-[13px] text-paper-dim">{t("requestHint")}</p>
              <textarea
                name="note"
                rows={2}
                maxLength={500}
                placeholder={t("requestPlaceholder")}
                className="field resize-none"
              />
              <button type="submit" className="btn-flame btn-press min-h-11 self-start rounded-xl px-5 text-sm">
                {t("sendRequest")}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
