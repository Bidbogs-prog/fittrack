import Link from "next/link";

/** The "Ft" mark — same design as the PWA icon (public/icons/icon.svg). */
export function LogoMark({ className = "size-8" }: { className?: string }) {
  return (
    <span
      className={`${className} grid shrink-0 place-items-center overflow-hidden rounded-lg bg-lime text-lime-ink`}
      aria-hidden
    >
      <svg viewBox="0 0 100 100" className="size-full font-display font-extrabold">
        <text
          x="50"
          y="66"
          textAnchor="middle"
          fontSize="62"
          letterSpacing="-3"
          fill="currentColor"
        >
          Ft
        </text>
        <rect x="26" y="76" width="48" height="7" rx="3.5" fill="currentColor" />
      </svg>
    </span>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-2.5 py-1">
      <LogoMark />
      <span className="font-display text-lg font-bold tracking-tight text-paper">
        Fit<span className="text-lime">Track</span>
      </span>
    </Link>
  );
}
