"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ArrowUp,
  Barcode,
  Camera,
  MagnifyingGlass,
  Microphone,
  Stop,
  X,
} from "@phosphor-icons/react";
import { AddFoodDialog } from "@/app/(app)/dashboard/add-food-dialog";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { mealForMinutes, minutesOfDate } from "@/lib/day-time";
import type { Food, MealType } from "@/lib/types";
import { ConfirmSheet } from "./confirm-sheet";
import { useLog } from "./log-provider";

/**
 * The docked composer: one box for "I ate…" and "coach, …". On mobile it
 * is fixed to the bottom and replaces the tab bar; on desktop it sticks to
 * the bottom of the centre column. It is also the anchor for the confirm
 * popover on desktop.
 *
 * mode "today": text is parsed into a meal (questions route to the coach).
 * mode "coach": text goes to onSend; the mic fills the box instead.
 */
export function Composer({
  mode = "today",
  chips,
  suggestions,
  onSend,
  sending = false,
}: {
  mode?: "today" | "coach";
  chips?: React.ReactNode;
  /** Tap-to-send prompts (coach starters), rendered as chips. */
  suggestions?: string[];
  onSend?: (text: string) => void;
  sending?: boolean;
}) {
  const t = useTranslations("composer");
  const log = useLog();
  const [value, setValue] = useState("");
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState<null | "browse" | "scan">(null);
  const [scanning, setScanning] = useState(false);
  const [meal, setMeal] = useState<MealType>("snack");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const busy = log.parsing || sending;

  function openSearch(view: "browse" | "scan") {
    setMeal(mealForMinutes(minutesOfDate(new Date())));
    setMenu(false);
    setSearch(view);
  }

  function pick(action: "photo" | "scan" | "search") {
    setMenu(false);
    if (action === "photo") fileRef.current?.click();
    else if (action === "scan") setScanning(true);
    else openSearch("browse");
  }

  function submit() {
    const text = value.trim();
    if (!text || busy) return;
    if (mode === "coach" && onSend) onSend(text);
    else log.submitText(text, "text");
    setValue("");
  }

  function toggleMic() {
    if (log.listening) {
      log.stopListening();
      return;
    }
    if (mode === "coach") {
      log.startListening((text) => {
        setValue((v) => (v ? `${v} ${text}` : text));
        inputRef.current?.focus();
      });
    } else {
      log.startListening();
    }
  }

  async function handleBarcode(code: string) {
    setScanning(false);
    try {
      const res = await fetch(`/api/foods/barcode?code=${encodeURIComponent(code)}`);
      const json = (await res.json()) as { food: Food | null };
      if (json.food) {
        log.addFood(json.food, json.food.serving_grams ?? 100);
        return;
      }
    } catch {
      // fall through to the miss message
    }
    log.setError(t("barcodeMiss"));
  }

  // ⌘K / Ctrl+K opens food search; Space (outside fields) holds to talk.
  useEffect(() => {
    const isField = (el: EventTarget | null) =>
      el instanceof HTMLElement &&
      (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(el.tagName));
    let spaceHeld = false;
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openSearch("browse");
        return;
      }
      if (mode === "today" && e.code === "Space" && !e.repeat && !isField(e.target) && !log.sheet) {
        e.preventDefault();
        spaceHeld = true;
        if (!log.listening) log.startListening();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space" && spaceHeld) {
        spaceHeld = false;
        log.stopListening();
      }
    };
    document.addEventListener("keydown", down);
    document.addEventListener("keyup", up);
    return () => {
      document.removeEventListener("keydown", down);
      document.removeEventListener("keyup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, log.listening, log.sheet, log.startListening, log.stopListening]);

  // Close the camera menu on outside click.
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [menu]);

  const placeholder = log.listening
    ? log.interim || t("listening")
    : log.parsing
      ? t("reading")
      : mode === "coach"
        ? t("coachPlaceholder")
        : t("placeholder");

  return (
    <div className="z-30 max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:bg-[linear-gradient(transparent,var(--ink-950)_30%)] max-lg:px-3.5 max-lg:pt-2.5 max-lg:pb-[max(1rem,env(safe-area-inset-bottom))] lg:sticky lg:bottom-0 lg:bg-[linear-gradient(transparent,var(--ink-950)_28%)] lg:pt-3 lg:pb-5">
      <div className="relative mx-auto flex w-full max-w-3xl flex-col gap-2">
        <ConfirmSheet />

        {(log.error || log.notice) && !log.sheet && (
          <p
            role={log.error ? "alert" : "status"}
            className={`flex items-start justify-between gap-3 rounded-xl border px-3 py-2 text-[13px] ${
              log.error ? "border-danger/30 bg-danger/[0.08] text-danger" : "border-fibre/30 bg-fibre/10 text-fibre"
            }`}
          >
            <span className="min-w-0">{log.error ?? log.notice}</span>
            <button
              type="button"
              onClick={log.clearMessages}
              aria-label={t("dismiss")}
              className="-m-1 shrink-0 p-1 opacity-70 hover:opacity-100"
            >
              <X weight="bold" className="size-3.5" />
            </button>
          </p>
        )}

        {(chips || suggestions) && (
          <div className="no-scrollbar -mx-3.5 flex gap-1.5 overflow-x-auto px-3.5 lg:mx-0 lg:px-0">
            {chips}
            {suggestions?.map((s) => (
              <ComposerChip key={s} disabled={busy} onClick={() => onSend?.(s)}>
                {s}
              </ComposerChip>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className={`flex items-center gap-2 rounded-[20px] border bg-ink-850 py-1.5 ps-2 pe-1.5 shadow-[0_12px_30px_-12px_rgba(0,0,0,0.8)] transition-colors lg:py-2 lg:pe-2 ${
            log.listening ? "border-flame/60" : "border-ink-700 focus-within:border-ink-600"
          }`}
        >
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenu((v) => !v)}
              aria-label={t("attach")}
              aria-expanded={menu}
              className="btn-press grid size-11 place-items-center rounded-xl bg-ink-800 text-paper-dim hover:text-paper lg:size-9"
            >
              <Camera weight="bold" className="size-[18px]" />
            </button>
            {menu && (
              <div className="dialog-pop absolute bottom-full start-0 mb-2 w-56 overflow-hidden rounded-2xl border border-ink-700 bg-ink-850 p-1 shadow-float">
                {(
                  [
                    [Camera, t("photo"), "photo"],
                    [Barcode, t("scan"), "scan"],
                    [MagnifyingGlass, t("search"), "search"],
                  ] as const
                ).map(([Icon, label, action]) => (
                  <button
                    key={action}
                    type="button"
                    onClick={() => pick(action)}
                    className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-start text-sm text-paper-dim hover:bg-ink-800 hover:text-paper"
                  >
                    <Icon weight="bold" className="size-4 text-flame" />
                    {label}
                  </button>
                ))}
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) log.submitPhoto(file);
                e.target.value = "";
              }}
            />
          </div>

          <textarea
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            maxLength={2000}
            dir="auto"
            placeholder={placeholder}
            aria-label={mode === "coach" ? t("coachPlaceholder") : t("placeholder")}
            className="max-h-32 min-h-9 min-w-0 flex-1 resize-none bg-transparent py-2 text-base text-paper outline-none placeholder:text-paper-mute pointer-fine:text-[15px]"
          />

          <button
            type="button"
            onClick={() => openSearch("browse")}
            className="shrink-0 rounded-md border border-ink-700 px-1.5 py-0.5 font-mono text-[11px] text-paper-mute hover:text-paper max-lg:hidden"
          >
            ⌘K {t("foods")}
          </button>

          <button
            type="button"
            onClick={toggleMic}
            aria-pressed={log.listening}
            aria-label={log.listening ? t("stopListening") : t("talk")}
            className={`btn-press grid size-11 shrink-0 place-items-center rounded-xl lg:size-9 ${
              log.listening ? "bg-flame-ink text-flame" : "bg-ink-800 text-paper-dim hover:text-paper"
            }`}
          >
            {log.listening ? (
              <Stop weight="fill" className="size-4" />
            ) : (
              <Microphone weight="bold" className="size-[18px]" />
            )}
          </button>
          <button
            type="submit"
            disabled={busy || !value.trim()}
            aria-label={t("send")}
            className="btn-flame btn-press grid size-11 shrink-0 place-items-center rounded-xl disabled:opacity-50 lg:size-9"
          >
            {busy ? (
              <span className="size-4 animate-spin rounded-full border-2 border-flame-ink/30 border-t-flame-ink" />
            ) : (
              <ArrowUp weight="bold" className="size-[18px]" />
            )}
          </button>
        </form>
      </div>

      {scanning && (
        <div
          className="overlay-fade fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 p-4 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setScanning(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("scan")}
            className="dialog-pop w-full max-w-md rounded-3xl border border-ink-700 bg-ink-900 p-5 shadow-float"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-paper">{t("scan")}</h2>
              <button
                type="button"
                onClick={() => setScanning(false)}
                aria-label={t("dismiss")}
                className="btn-press grid size-10 place-items-center rounded-lg text-paper-mute hover:bg-ink-800 hover:text-paper"
              >
                <X weight="bold" className="size-4" />
              </button>
            </div>
            <BarcodeScanner onDetected={handleBarcode} className="mt-3" />
          </div>
        </div>
      )}

      <AddFoodDialog
        meal={meal}
        entryDate={log.entryDate}
        open={search != null}
        initialView={search ?? "browse"}
        onOpenChange={(o) => {
          if (!o) setSearch(null);
        }}
      />
    </div>
  );
}

/** Pill chip for the composer rail. */
export function ComposerChip({
  children,
  onClick,
  href,
  tone = "default",
  type = "button",
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  tone?: "default" | "water";
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  const cls = `btn-press inline-flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-full border border-ink-700 bg-ink-900 px-3 text-xs font-medium transition-colors hover:border-ink-600 disabled:opacity-50 ${
    tone === "water" ? "text-carbs" : "text-paper-dim hover:text-paper"
  }`;
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}
