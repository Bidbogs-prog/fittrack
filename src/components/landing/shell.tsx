/** Shared framing for landing bento cards — double-bezel glass shell. */
export function Shell({
  children,
  className = "",
  inner = "",
}: {
  children: React.ReactNode;
  className?: string;
  inner?: string;
}) {
  return (
    <div
      data-reveal
      className={`card-lift rounded-[1.9rem] border border-white/[0.08] bg-white/[0.03] p-2 ${className}`}
    >
      <div
        className={`h-full rounded-[calc(1.9rem-0.5rem)] border border-white/[0.05] bg-ink-900/80 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:p-7 md:p-8 ${inner}`}
      >
        {children}
      </div>
    </div>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="inline-flex items-center rounded-full border border-ink-700 bg-ink-950/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-paper-mute">
      {children}
    </p>
  );
}
