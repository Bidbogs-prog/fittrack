"use client";

/**
 * In-page link to a landing section. Scrolls without adding a history entry:
 * plain #anchors pushed one entry per click, so after visiting a page such as
 * /refunds the Back button walked through #faq, #how… instead of leaving.
 */
export function SectionLink({ id, className, children }: { id: string; className?: string; children: React.ReactNode }) {
  return (
    <a
      href={`#${id}`}
      className={className}
      onClick={(e) => {
        const el = document.getElementById(id);
        if (!el || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        window.history.replaceState(window.history.state, "", `#${id}`);
      }}
    >
      {children}
    </a>
  );
}
