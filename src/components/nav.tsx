"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ChartLineUp,
  ChatCircleText,
  ForkKnife,
  Gauge,
  ListChecks,
  ShieldStar,
  UserCircle,
  type Icon,
} from "@phosphor-icons/react";

const LINKS: { href: string; labelKey: string; shortKey: string; icon: Icon }[] = [
  { href: "/dashboard", labelKey: "today", shortKey: "today", icon: Gauge },
  { href: "/history", labelKey: "history", shortKey: "history", icon: ChartLineUp },
  { href: "/coach", labelKey: "coach", shortKey: "coach", icon: ChatCircleText },
  { href: "/foods", labelKey: "foodLibrary", shortKey: "foods", icon: ForkKnife },
  { href: "/plans", labelKey: "plans", shortKey: "plansShort", icon: ListChecks },
];

const ADMIN_LINK = { href: "/admin", labelKey: "admin", shortKey: "admin", icon: ShieldStar };
const ACCOUNT_LINK = { href: "/account", labelKey: "account", shortKey: "account", icon: UserCircle };

export function AppNav({
  admin,
  account = false,
}: {
  admin: boolean;
  /**
   * Append the Account link — used by the mobile bottom bar, where the
   * desktop sidebar's user block (body stats, settings, sign out) doesn't
   * exist. /account carries those actions on mobile.
   */
  account?: boolean;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const links = [...LINKS, ...(admin ? [ADMIN_LINK] : []), ...(account ? [ACCOUNT_LINK] : [])];

  return (
    <nav className="flex gap-1 max-md:w-full max-md:justify-around md:flex-col">
      {links.map(({ href, labelKey, shortKey, icon: Icon }) => {
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
            <span className="md:hidden">{t(shortKey)}</span>
            <span className="max-md:hidden">{t(labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
