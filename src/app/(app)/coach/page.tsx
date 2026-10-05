import { CaretDown, ChatCircleText, Plus } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { MiniDial } from "@/components/orbit/orbit";
import { LogProvider } from "@/components/orbit/log-provider";
import { getCoachAllowance } from "@/lib/ai-usage";
import { getProfile } from "@/lib/auth";
import { isPremium } from "@/lib/entitlements";
import { COACH_BRIEFS } from "@/lib/coach/evidence";
import { SAFETY } from "@/lib/coach/safety";
import { ageFromBirthDate } from "@/lib/nutrition";
import type { CoachConversation, CoachMessage } from "@/lib/types";
import { getDayData, toDateString } from "../dashboard/day-data";
import { DayRail } from "../dashboard/rail";
import { CoachChat, type ChatMessage } from "./coach-chat";

export const metadata = { title: "Coach" };

const BRIEF_TITLES = new Map(COACH_BRIEFS.map((b) => [b.id, b.title]));

export default async function CoachPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; q?: string }>;
}) {
  const [{ supabase, userId, profile }, params, t] = await Promise.all([
    getProfile(),
    searchParams,
    getTranslations("coach"),
  ]);
  const [data, format, premium] = await Promise.all([
    getDayData(toDateString(new Date())),
    getFormatter(),
    isPremium(supabase, userId),
  ]);
  const allowance = await getCoachAllowance(supabase, userId, premium);
  const planLine = !allowance.known
    ? null
    : premium
      ? allowance.daily != null
        ? t("planPremium", { left: Math.max(0, allowance.daily - allowance.usedToday) })
        : null
      : allowance.monthly != null
        ? t("planFree", { left: Math.max(0, allowance.monthly - allowance.usedMonth), monthly: allowance.monthly })
        : null;

  const header = (
    <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-ink-800 bg-ink-950/85 py-2.5 ps-[18px] pe-28 backdrop-blur-md lg:ps-9 lg:pe-36">
      <Link href="/dashboard" aria-label={t("backToOrbit")} className="shrink-0 rounded-full">
        <MiniDial
          fraction={data.kcalTarget > 0 ? (data.kcalTarget - data.remaining) / data.kcalTarget : 0}
          size={44}
          stroke={9}
        />
      </Link>
      <div className="min-w-0 flex-1">
        <p className={`font-mono text-base font-semibold tabular ${data.remaining < 0 ? "text-danger" : "text-flame"}`}>
          {format.number(Math.abs(data.remaining))}{" "}
          <span className="font-sans text-xs font-normal text-paper-mute">
            {data.remaining < 0 ? t("kcalOver") : t("kcalLeft")}
          </span>
        </p>
        <p className={`truncate text-[11px] ${premium ? "text-flame" : "text-paper-mute"}`}>{planLine ?? t("tapRing")}</p>
      </div>
    </div>
  );

  // Adults only — decided in roadmap 1.6: a hard gate, not a softer mode.
  if (!profile.birth_date || ageFromBirthDate(profile.birth_date) < SAFETY.minAge) {
    return (
      <div className="lg:grid lg:min-h-[100dvh] lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          {header}
          <div className="mx-auto max-w-lg px-[18px] py-16 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-flame/10 ring-1 ring-inset ring-flame/25">
              <ChatCircleText weight="fill" className="size-6 text-flame" />
            </span>
            <h1 className="mt-5 font-display text-2xl font-bold tracking-tight text-paper">{t("adultsTitle")}</h1>
            <p className="mt-3 text-sm leading-relaxed text-paper-dim">{t("adultsBody")}</p>
          </div>
        </div>
        <div className="max-lg:hidden">
          <DayRail data={data} />
        </div>
      </div>
    );
  }

  const { data: conversationsData } = await supabase
    .from("coach_conversations")
    .select("id, user_id, title, summary, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(12);
  const conversations = (conversationsData ?? []) as CoachConversation[];

  // ?c=new forces a fresh chat; otherwise the requested or latest one.
  const requested = params.c === "new" ? null : (params.c ?? conversations[0]?.id ?? null);
  const conversation = conversations.find((c) => c.id === requested) ?? null;
  const initialPrompt =
    params.c === "new" && params.q ? params.q.trim().slice(0, 2000) || null : null;

  let messages: CoachMessage[] = [];
  if (conversation) {
    const { data: messageData } = await supabase
      .from("coach_messages")
      .select("*")
      .eq("conversation_id", conversation.id)
      .order("created_at")
      .limit(200);
    messages = (messageData ?? []) as CoachMessage[];
  }

  const chatMessages: ChatMessage[] = messages.map((m) => {
    const briefIds = (m.payload as { briefs?: string[] } | null)?.briefs ?? [];
    return {
      id: m.id,
      role: m.role,
      content: m.content,
      sources: briefIds.map((id) => BRIEF_TITLES.get(id)).filter((x): x is string => !!x),
    };
  });

  return (
    <LogProvider entryDate={data.date} isToday entryIds={data.entries.map((e) => e.id)}>
      <div className="lg:grid lg:min-h-[100dvh] lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-h-[calc(100dvh-7rem)] min-w-0 flex-col max-lg:pb-40 lg:min-h-[100dvh]">
          <div className="sticky top-0 z-20">
            {header}
            {/* Chats ▾ — conversation switcher */}
            <details className="group absolute end-[18px] top-1/2 -translate-y-1/2 lg:end-9">
              <summary className="flex min-h-9 cursor-pointer list-none items-center gap-1 rounded-full border border-ink-700 bg-ink-950/60 px-3 text-xs text-paper-dim hover:text-paper [&::-webkit-details-marker]:hidden">
                {t("chats")}
                <CaretDown weight="bold" className="size-3 transition-transform group-open:rotate-180" />
              </summary>
              <div className="dialog-pop absolute end-0 top-full mt-2 w-64 overflow-hidden rounded-2xl border border-ink-700 bg-ink-850 p-1 shadow-float">
                <Link
                  href="/coach?c=new"
                  className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium text-flame hover:bg-ink-800"
                >
                  <Plus weight="bold" className="size-4" />
                  {t("newChat")}
                </Link>
                {conversations.length > 0 && <div className="my-1 h-px bg-ink-800" />}
                <ul className="max-h-72 overflow-y-auto">
                  {conversations.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/coach?c=${c.id}`}
                        aria-current={conversation?.id === c.id ? "page" : undefined}
                        className={`flex min-h-11 items-center truncate rounded-xl px-3 text-sm hover:bg-ink-800 ${
                          conversation?.id === c.id ? "text-paper" : "text-paper-dim"
                        }`}
                      >
                        <span className="truncate">{c.title ?? t("untitled")}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </details>
          </div>

          <h1 className="sr-only">{t("title")}</h1>
          <p className="mx-[18px] mt-3.5 flex items-center gap-2.5 rounded-[14px] border border-ink-800 px-3 py-2 text-xs text-paper-mute lg:mx-9">
            <MiniDial fraction={1} size={22} stroke={6} color={data.remaining >= 0 ? "var(--fibre)" : "var(--flame-deep)"} />
            {t("daySummary", {
              eaten: format.number(Math.round(data.eaten.kcal)),
              target: format.number(data.kcalTarget),
            })}
          </p>

          <CoachChat
            key={conversation?.id ?? `new-${initialPrompt ?? ""}`}
            conversationId={conversation?.id ?? null}
            initialMessages={chatMessages}
            initialPrompt={initialPrompt}
          />
        </div>

        {/* Mobile keeps the full-page chat; the rail is desktop-only here. */}
        <div className="max-lg:hidden">
          <DayRail data={data} />
        </div>
      </div>
    </LogProvider>
  );
}
