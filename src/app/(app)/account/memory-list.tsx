"use client";

import { useOptimistic, useTransition } from "react";
import { useTranslations } from "next-intl";
import { X } from "@phosphor-icons/react";
import { forgetMemory } from "./memory-actions";

/** What the coach remembers — every fact visible and deletable (premium). */
export function MemoryList({ memories }: { memories: { id: string; fact: string }[] }) {
  const t = useTranslations("me");
  const [, start] = useTransition();
  const [shown, remove] = useOptimistic(memories, (list, id: string | null) =>
    id ? list.filter((m) => m.id !== id) : []
  );

  if (shown.length === 0) return <p className="text-[13px] text-paper-mute">{t("memoryEmpty")}</p>;
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col divide-y divide-ink-800 rounded-xl border border-ink-800">
        {shown.map((m) => (
          <li key={m.id} className="flex items-center gap-2 px-3 py-2">
            <span dir="auto" className="min-w-0 flex-1 text-[13px] text-paper-dim">
              {m.fact}
            </span>
            <button
              type="button"
              aria-label={t("memoryForget", { fact: m.fact })}
              onClick={() =>
                start(async () => {
                  remove(m.id);
                  await forgetMemory(m.id);
                })
              }
              className="grid size-8 shrink-0 place-items-center rounded-full text-paper-mute hover:bg-ink-800 hover:text-danger"
            >
              <X weight="bold" className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() =>
          start(async () => {
            remove(null);
            await forgetMemory(null);
          })
        }
        className="self-start text-xs text-paper-mute hover:text-danger"
      >
        {t("memoryForgetAll")}
      </button>
    </div>
  );
}
