import { ChatCircleText, Plus } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Reveal } from "@/components/motion/reveal";
import { getActiveTargets } from "@/lib/adaptive";
import { getProfile } from "@/lib/auth";
import { ageFromBirthDate } from "@/lib/nutrition";
import { SAFETY } from "@/lib/coach/safety";
import type { CoachConversation, CoachMessage } from "@/lib/types";
import { CoachChat } from "./coach-chat";

export const metadata = { title: "Coach" };

export default async function CoachPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const [{ supabase, userId, profile }, params] = await Promise.all([getProfile(), searchParams]);

  const active = await getActiveTargets(supabase, userId, profile);
  if (!active) redirect("/onboarding");

  // Adults only — decided in roadmap 1.6: a hard gate, not a softer mode.
  if (!profile.birth_date || ageFromBirthDate(profile.birth_date) < SAFETY.minAge) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-lime/10 ring-1 ring-inset ring-lime/25">
          <ChatCircleText weight="fill" className="size-6 text-lime" />
        </span>
        <h1 className="mt-5 font-display text-2xl font-bold tracking-tight text-paper">
          The coach is for adults
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-paper-dim">
          The AI coach is only available from age 18. Everything else in FitTrack — logging,
          targets, history — works exactly the same for you, and a parent, doctor or dietitian
          is the right person to talk nutrition goals with at your age.
        </p>
      </div>
    );
  }

  const { data: conversationsData } = await supabase
    .from("coach_conversations")
    .select("id, user_id, title, summary, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(8);
  const conversations = (conversationsData ?? []) as CoachConversation[];

  // ?c=new forces a fresh chat; otherwise the requested or latest one.
  const requested = params.c === "new" ? null : (params.c ?? conversations[0]?.id ?? null);
  const conversation = conversations.find((c) => c.id === requested) ?? null;

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

  const firstName = profile.full_name?.split(" ")[0] ?? "athlete";

  return (
    // Fixed height, not min-height: the thread scrolls inside its own window
    // instead of growing the page (see coach-chat.tsx for the scroll logic).
    <div className="flex h-[calc(100dvh-16rem)] min-h-[24rem] flex-col gap-5 md:h-[calc(100dvh-11rem)]">
      <Reveal as="header" onScroll={false} className="flex flex-wrap items-end justify-between gap-4">
        <div data-reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-lime">
            AI coach
          </p>
          <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tighter text-paper md:text-4xl">
            In your corner, {firstName}.
          </h1>
        </div>
        {conversations.length > 0 && (
          <nav data-reveal className="flex max-w-full items-center gap-1.5 overflow-x-auto pb-1">
            <Link
              href="/coach?c=new"
              className={`btn-press inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                conversation == null
                  ? "border-lime/50 text-lime"
                  : "border-ink-700 text-paper-dim hover:border-lime/50 hover:text-lime"
              }`}
            >
              <Plus weight="bold" className="size-3.5" />
              New chat
            </Link>
            {conversations.map((c) => (
              <Link
                key={c.id}
                href={`/coach?c=${c.id}`}
                className={`shrink-0 truncate rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors max-w-44 ${
                  conversation?.id === c.id
                    ? "border-lime/50 bg-lime/10 text-lime"
                    : "border-ink-700 text-paper-mute hover:border-ink-600 hover:text-paper"
                }`}
              >
                {c.title ?? "Untitled"}
              </Link>
            ))}
          </nav>
        )}
      </Reveal>

      <CoachChat
        key={conversation?.id ?? "new"}
        conversationId={conversation?.id ?? null}
        initialMessages={messages}
      />
    </div>
  );
}
