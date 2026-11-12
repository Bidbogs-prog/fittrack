"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Barcode, X } from "@phosphor-icons/react";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { lookupBarcode } from "@/lib/barcode-lookup";

/** Scan a product barcode and jump to its food page. */
export function ScanButton({ variant = "badge" }: { variant?: "badge" | "button" }) {
  const t = useTranslations("foods");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [miss, setMiss] = useState<string | null>(null);
  /** Lookup failed (offline, signed out, server): not the same as "not in the library" (AUD-13). */
  const [failed, setFailed] = useState<{ code: string; signedOut: boolean } | null>(null);

  async function detected(code: string) {
    setFailed(null);
    const r = await lookupBarcode(code);
    if (r.kind === "found") {
      setOpen(false);
      router.push(`/foods/${r.food.id}`);
      return;
    }
    if (r.kind === "missing") setMiss(code);
    else setFailed({ code, signedOut: r.kind === "signedOut" });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setMiss(null);
          setFailed(null);
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
            {failed ? (
              <div role="alert" className="mt-4 space-y-3 text-sm text-paper-dim">
                <p>{t(failed.signedOut ? "scanSignedOut" : "scanError")}</p>
                {!failed.signedOut && (
                  <button
                    type="button"
                    onClick={() => void detected(failed.code)}
                    className="btn-press inline-flex min-h-11 items-center rounded-xl border border-ink-700 px-4"
                  >
                    {t("scanRetry")}
                  </button>
                )}
              </div>
            ) : miss ? (
              <div className="mt-4 space-y-3 text-sm text-paper-dim">
                <p>{t("scanMiss", { code: miss })}</p>
                <Link href={`/foods/new?barcode=${encodeURIComponent(miss)}&from=scan`} className="btn-flame btn-press inline-flex min-h-11 items-center rounded-xl px-4">
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
