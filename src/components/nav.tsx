"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ChartLineUp,
  ForkKnife,
  Gauge,
  ListChecks,
  UserCircle,
  type Icon,
} from "@phosphor-icons/react";

type NavKey = "today" | "history" | "plans" | "foods" | "me";

const LINKS: { key: NavKey; href: string; icon: Icon }[] = [
  { key: "today", href: "/dashboard", icon: Gauge },
  { key: "history", href: "/history", icon: ChartLineUp },
  { key: "plans", href: "/plans", icon: ListChecks },
  { key: "foods", href: "/foods", icon: ForkKnife },
  { key: "me", href: "/account", icon: UserCircle },
];

/** Which tab owns a route: the coach lives inside Today's thread. */
function activeKey(pathname: string): NavKey | null {
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/coach")) return "today";
  if (pathname.startsWith("/history")) return "history";
  if (pathname.startsWith("/plans")) return "plans";
  if (pathname.startsWith("/foods") || pathname.startsWith("/recipes")) return "foods";
  if (pathname.startsWith("/account") || pathname.startsWith("/admin")) return "me";
  return null;
}

/** Desktop sidebar navigation. */
export function SideNav() {
  const t = useTranslations("nav");
  const active = activeKey(usePathname());
  return (
    <nav aria-label={t("label")} className="flex flex-col gap-1">
      {LINKS.map(({ key, href, icon: Icon }) => {
        const on = active === key;
        return (
          <Link
            key={key}
            href={href}
            aria-current={on ? "page" : undefined}
            className={`btn-press flex min-h-10 items-center gap-3 rounded-[10px] px-3 text-sm font-medium transition-colors duration-300 ease-[var(--ease-ui)] ${
              on ? "bg-flame/10 text-flame" : "text-paper-mute hover:bg-ink-900 hover:text-paper"
            }`}
          >
            <Icon weight={on ? "fill" : "regular"} className="size-[18px] shrink-0" />
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}

/** Mobile segmented tabs under the header (Me lives behind the avatar). */
export function MobileTabs() {
  const t = useTranslations("nav");
  const active = activeKey(usePathname());
  return (
    <nav
      aria-label={t("label")}
      className="mx-3.5 mb-1.5 flex gap-1 rounded-[14px] border border-ink-800 bg-ink-900 p-1"
    >
      {LINKS.filter((l) => l.key !== "me").map(({ key, href }) => {
        const on = active === key;
        return (
          <Link
            key={key}
            href={href}
            aria-current={on ? "page" : undefined}
            className={`grid min-h-9 flex-1 place-items-center rounded-[10px] text-[13px] font-medium transition-colors duration-300 ease-[var(--ease-ui)] ${
              on ? "bg-ink-800 text-paper" : "text-paper-mute hover:text-paper"
            }`}
          >
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Main column wrapper: Today and Coach own their full-bleed layout (dial,
 * thread, docked composer, right rail); every other page gets the standard
 * gutter and spans the remaining columns.
 */
export function MainFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bleed = pathname.startsWith("/dashboard") || pathname.startsWith("/coach");
  return (
    <main
      className={`min-w-0 flex-1 ${
        bleed ? "" : "px-[18px] pt-2 pb-16 lg:px-9 lg:pt-8 lg:pb-12"
      }`}
    >
      <div className={bleed ? "" : "mx-auto w-full max-w-[1180px]"}>{children}</div>
    </main>
  );
}
