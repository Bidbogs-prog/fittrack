"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Barcode, X } from "@phosphor-icons/react";
import { BarcodeScanner } from "@/components/barcode-scanner";
import type { Food } from "@/lib/types";

/** Scan a product barcode and jump to its food page. */
export function ScanButton({ variant = "badge" }: { variant?: "badge" | "button" }) {
  const t = useTranslations("foods");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [miss, setMiss] = useState<string | null>(null);

  async function detected(code: string) {
    try {
      const res = await fetch(`/api/foods/barcode?code=${encodeURIComponent(code)}`);
      const json = (await res.json()) as { food: Food | null };
      if (json.food) {
        setOpen(false);
        router.push(`/foods/${json.food.id}`);
        return;
      }
    } catch {
      // fall through
    }
    setMiss(code);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setMiss(null);
          setOpen(true);
        }}
        className={
          variant === "badge"
            ? "btn-press inline-flex min-h-9 items-center gap-1 rounded-md border border-ink-700 px-2 font-mono text-[11px] text-paper-mute hover:text-paper"
            : "btn-press inline-flex min-h-12 items-center gap-2 rounded-[14px] border border-ink-700 px-4 text-sm text-paper-dim hover:text-paper"
        }
      >
        <Barcode weight="bold" className="size-3.5" />
        {variant === "badge" ? t("scanShort") : t("scan")}
      </button>
      {open && (
        <div
          className="overlay-fade fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 p-4 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
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
                onClick={() => setOpen(false)}
                aria-label={t("close")}
                className="btn-press grid size-10 place-items-center rounded-lg text-paper-mute hover:bg-ink-800 hover:text-paper"
              >
                <X weight="bold" className="size-4" />
              </button>
            </div>
            {miss ? (
              <div className="mt-4 space-y-3 text-sm text-paper-dim">
                <p>{t("scanMiss", { code: miss })}</p>
                <Link href="/foods/new" className="btn-flame btn-press inline-flex min-h-11 items-center rounded-xl px-4">
                  {t("createFood")}
                </Link>
              </div>
            ) : (
              <BarcodeScanner onDetected={detected} className="mt-3" />
            )}
          </div>
        </div>
      )}
    </>
  );
}
