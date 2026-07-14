"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/foods", label: "Food library" },
  { href: "/admin/plans", label: "Meal plans" },
];

export function AdminTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-6 border-b border-ink-800" aria-label="Admin sections">
      {TABS.map(({ href, label }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 pb-3 text-sm font-semibold transition-colors ${
              active
                ? "border-lime text-lime"
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
