"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/foods", label: "Food library" },
  { href: "/admin/foods/review", label: "Food review" },
  { href: "/admin/plans", label: "Meal plans" },
  { href: "/admin/requests", label: "Plan requests" },
  { href: "/admin/beta", label: "Beta" },
];

export function AdminTabs() {
  const pathname = usePathname();
  return (
    // The divider is an inset shadow, not border-b + -mb-px on the tabs: a
    // negative margin makes content 1px taller than this overflow-x-auto
    // box, which shows up as a vertical scrollbar.
    <nav
      className="flex gap-6 overflow-x-auto whitespace-nowrap shadow-[inset_0_-1px_0_var(--color-ink-800)]"
      aria-label="Admin sections"
    >
      {TABS.map(({ href, label }) => {
        // The most specific tab wins (/admin/foods/review isn't "Food library").
        const active =
          pathname.startsWith(href) &&
          !TABS.some((o) => o.href.length > href.length && o.href.startsWith(href) && pathname.startsWith(o.href));
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`border-b-2 py-3 text-sm font-semibold transition-colors ${
              active
                ? "border-flame text-flame"
                : "border-transparent text-paper-mute hover:text-paper"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
