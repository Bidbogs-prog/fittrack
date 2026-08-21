import Link from "next/link";
import { LOGO_MARK_PATH } from "@/lib/site";

/**
 * The "3" mark — the Arabizi ع of So3ra (سعرة, "calorie"), set in the same
 * Outfit Bold glyph as the wordmark. Same design as the PWA icon
 * (public/icons/icon.svg).
 */
export function LogoMark({ className = "size-8" }: { className?: string }) {
  return (
    <span
      className={`${className} grid shrink-0 place-items-center overflow-hidden rounded-lg bg-lime text-lime-ink`}
      aria-hidden
    >
      <svg viewBox="0 0 100 100" className="size-full">
        <path d={LOGO_MARK_PATH} fill="currentColor" />
      </svg>
    </span>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-2.5 py-1">
      <LogoMark />
      <span className="font-display text-lg font-bold tracking-tight text-paper">
        So<span className="text-lime">3</span>ra
      </span>
    </Link>
  );
}
