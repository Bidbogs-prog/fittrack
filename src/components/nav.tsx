"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ForkKnife,
  Gauge,
  ListChecks,
  ShieldStar,
  type Icon,
} from "@phosphor-icons/react";

const LINKS: { href: string; label: string; icon: Icon }[] = [
  { href: "/dashboard", label: "Today", icon: Gauge },
  { href: "/foods", label: "Food library", icon: ForkKnife },
  { href: "/plans", label: "Meal plans", icon: ListChecks },
];

const ADMIN_LINK = { href: "/admin", label: "Admin", icon: ShieldStar };

export function AppNav({ admin }: { admin: boolean }) {
  const pathname = usePathname();
  const links = admin ? [...LINKS, ADMIN_LINK] : LINKS;

  return (
    <nav className="flex gap-1 max-md:w-full max-md:justify-around md:flex-col">
      {links.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`btn-press flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors max-md:flex-col max-md:gap-1 max-md:px-2 max-md:py-1.5 max-md:text-[11px] ${
              active
                ? "bg-lime/10 text-lime"
                : "text-paper-mute hover:bg-ink-800 hover:text-paper"
            }`}
          >
            <Icon weight={active ? "fill" : "regular"} className="size-5 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
