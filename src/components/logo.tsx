import Link from "next/link";

export function LogoMark({ className = "size-8" }: { className?: string }) {
  return (
    <span
      className={`${className} grid shrink-0 place-items-center rounded-lg bg-lime text-lime-ink`}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-[62%]">
        {/* barbell */}
        <path
          d="M2 12h3M19 12h3M7 7v10M17 7v10M7 12h10"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-2.5">
      <LogoMark />
      <span className="font-display text-lg font-bold tracking-tight text-paper">
        Fit<span className="text-lime">Track</span>
      </span>
    </Link>
  );
}
