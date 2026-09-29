"use client";

import { useTranslations } from "next-intl";
import { dayPart } from "@/lib/day-time";
import { useNowMinutes } from "@/lib/use-client-clock";

/**
 * "Evening, Yassine". The part of day comes from the viewer's clock, so
 * the server renders a neutral greeting and the client refines it.
 */
export function Greeting({ name, className }: { name: string; className?: string }) {
  const t = useTranslations("today");
  const now = useNowMinutes();
  return <h1 className={className}>{t(now == null ? "greeting.neutral" : `greeting.${dayPart(now)}`, { name })}</h1>;
}
