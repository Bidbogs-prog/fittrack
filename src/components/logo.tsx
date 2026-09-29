import Link from "next/link";
import { LOGO_MARK_PATH } from "@/lib/site";

/**
 * The "3" mark — the Arabizi ع of So3ra (سعرة, "calorie"), set in the same
 * Outfit Bold glyph as the wordmark, on the flame gradient. Same design as
 * the PWA icon (public/icons/icon.svg).
 */
export function LogoMark({ className = "size-8" }: { className?: string }) {
  return (
    <span
      className={`${className} grid shrink-0 place-items-center overflow-hidden rounded-[28%] text-flame-ink`}
      style={{ background: "var(--grad-flame)" }}
      aria-hidden
    >
      <svg viewBox="0 0 100 100" className="size-full">
        <path d={LOGO_MARK_PATH} fill="currentColor" />
      </svg>
    </span>
  );
}

export function Logo({ href = "/", size = "md" }: { href?: string; size?: "sm" | "md" }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-2.5 py-1">
      <LogoMark className={size === "sm" ? "size-7" : "size-8"} />
      <span
        className={`font-display font-bold tracking-[-0.02em] text-paper ${size === "sm" ? "text-[17px]" : "text-[19px]"}`}
      >
        So<span className="text-flame">3</span>ra
      </span>
    </Link>
  );
}
