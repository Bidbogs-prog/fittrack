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

const LINKS: { href: string; label: string; short: string; icon: Icon }[] = [
  { href: "/dashboard", label: "Today", short: "Today", icon: Gauge },
  { href: "/foods", label: "Food library", short: "Foods", icon: ForkKnife },
  { href: "/plans", label: "Meal plans", short: "Plans", icon: ListChecks },
];

const ADMIN_LINK = { href: "/admin", label: "Admin", short: "Admin", icon: ShieldStar };

export function AppNav({ admin }: { admin: boolean }) {
  const pathname = usePathname();
  const links = admin ? [...LINKS, ADMIN_LINK] : LINKS;

  return (
    <nav className="flex gap-1 max-md:w-full max-md:justify-around md:flex-col">
      {links.map(({ href, label, short, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`btn-press flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] max-md:flex-col max-md:gap-1 max-md:px-2 max-md:py-2 max-md:text-[11px] ${
              active
                ? "bg-lime/10 text-lime"
                : "text-paper-mute hover:bg-ink-800 hover:text-paper"
            }`}
          >
            <Icon weight={active ? "fill" : "regular"} className="size-5 shrink-0" />
            <span className="md:hidden">{short}</span>
            <span className="max-md:hidden">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
