"use server";

import { revalidatePath } from "next/cache";
import { getActiveTargets } from "@/lib/adaptive";
import { getProfile } from "@/lib/auth";
import { buildCoachContext } from "@/lib/coach/context";
import { briefsPromptBlock, selectBriefs } from "@/lib/coach/evidence";
import { GeminiError, generateText, type GeminiTurn } from "@/lib/gemini";
import { ageFromBirthDate } from "@/lib/nutrition";
import { coachSystemPrompt } from "@/lib/coach/prompt";
import { SAFETY, type SafetyFlag } from "@/lib/coach/safety";
import type { CoachMessage } from "@/lib/types";

/** Turns sent verbatim; older ones live in the rolling summary. */
const VERBATIM_TURNS = 12;
/** Start summarising once a conversation grows past this many messages. */
const SUMMARY_AFTER = 20;
const MAX_MESSAGE_LEN = 2000;

export interface CoachReply {
  reply: string;
  conversationId: string;
  restricted: boolean;
  flags: SafetyFlag[];
}

export async function sendCoachMessage(
  fd: FormData
): Promise<{ data: CoachReply; error: null } | { data: null; error: string }> {
  const { supabase, userId, profile } = await getProfile();

  // The under-18 gate is enforced here, not just in the page UI.
  if (!profile.birth_date) {
    return { data: null, error: "Finish onboarding so the coach knows your targets." };
  }
  if (ageFromBirthDate(profile.birth_date) < SAFETY.minAge) {
    return { data: null, error: "The coach is only available for adults (18+)." };
  }

  const message = String(fd.get("message") ?? "").trim();
  if (!message) return { data: null, error: "Write a message first." };
  if (message.length > MAX_MESSAGE_LEN) {
    return { data: null, error: `Keep messages under ${MAX_MESSAGE_LEN} characters.` };
  }

  const active = await getActiveTargets(supabase, userId, profile);
  if (!active) {
    return { data: null, error: "Finish onboarding so the coach knows your targets." };
  }

  // Load (and verify ownership of) the conversation, or start a new one.
  const requestedId = fd.get("conversation_id");
  let conversationId: string | null = null;
  let summary: string | null = null;
  if (typeof requestedId === "string" && requestedId) {
    const { data: convo } = await supabase
      .from("coach_conversations")
      .select("id, summary")
      .eq("id", requestedId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!convo) return { data: null, error: "That conversation no longer exists." };
    conversationId = convo.id as string;
    summary = (convo.summary as string | null) ?? null;
  }

  const history: CoachMessage[] = [];
  let total = 0;
  if (conversationId) {
    const [{ data: recent }, { count }] = await Promise.all([
      supabase
        .from("coach_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(VERBATIM_TURNS),
      supabase
        .from("coach_messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", conversationId),
    ]);
    history.push(...((recent ?? []) as CoachMessage[]).reverse());
    total = count ?? history.length;
  }

  const { context, safety } = await buildCoachContext(supabase, userId, profile, active);
  if (safety.blocked) {
    return { data: null, error: "The coach is only available for adults (18+)." };
  }

  const systemPrompt = coachSystemPrompt(safety.restricted);

  // Deterministic topic router (roadmap 1.6 B): curated, cited briefs for
  // the topics this message touches — the model is told to prefer them
  // over its own memory.
  const briefs = selectBriefs(message);

  const turns: GeminiTurn[] = [
    {
      role: "user",
      text: `${context}${summary ? `\n\nEARLIER IN THIS CONVERSATION (summary)\n${summary}` : ""}${briefsPromptBlock(briefs)}\n\n(The conversation starts now. Reply only as the coach.)`,
    },
    { role: "model", text: "Understood — I have their data and I'm ready." },
    ...history.map<GeminiTurn>((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      text: m.content,
    })),
    { role: "user", text: message },
  ];

  let reply: string;
  try {
    // 0.4: prose stays warm enough, numeric fidelity is measurably better.
    reply = (await generateText({ systemPrompt, turns, temperature: 0.4 })).trim();
  } catch (err) {
    if (err instanceof GeminiError) return { data: null, error: err.message };
    throw err;
  }

  // Persist the exchange; create the conversation lazily on first message.
  if (!conversationId) {
    const { data: created, error: createError } = await supabase
      .from("coach_conversations")
      .insert({ user_id: userId, title: message.slice(0, 60) })
      .select("id")
      .single();
    if (createError || !created) {
      return { data: null, error: "Could not start the conversation. Try again." };
    }
    conversationId = created.id as string;
  }

  const { error: insertError } = await supabase.from("coach_messages").insert([
    { conversation_id: conversationId, role: "user", content: message },
    {
      conversation_id: conversationId,
      role: "assistant",
      content: reply.slice(0, 8000),
      payload: {
        flags: safety.flags,
        restricted: safety.restricted,
        briefs: briefs.map((b) => b.id),
      },
    },
  ]);
  if (insertError) {
    return { data: null, error: "The reply could not be saved. Try again." };
  }
  await supabase
    .from("coach_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  // Rolling memory: past the threshold, refresh the summary every few
  // turns so trimmed-off messages stay represented. Best-effort — a
  // failed summary never fails the exchange.
  total += 2;
  if (total > SUMMARY_AFTER && total % 6 === 0) {
    try {
      const recap = await generateText({
        systemPrompt:
          "Summarise this coaching conversation for the coach's own memory: the user's situation, questions asked, advice given, and any commitments. Max 150 words, plain prose, no preamble.",
        turns: [
          {
            role: "user",
            text: `${summary ? `Previous summary:\n${summary}\n\n` : ""}Recent exchange:\n${history
              .map((m) => `${m.role}: ${m.content}`)
              .join("\n")}\nuser: ${message}\nassistant: ${reply}`,
          },
        ],
        temperature: 0.3,
        maxOutputTokens: 300,
      });
      await supabase
        .from("coach_conversations")
        .update({ summary: recap.trim() })
        .eq("id", conversationId);
    } catch {
      // keep the old summary
    }
  }

  revalidatePath("/coach");
  return {
    data: { reply, conversationId, restricted: safety.restricted, flags: safety.flags },
    error: null,
  };
}

export async function deleteCoachConversation(fd: FormData): Promise<void> {
  const { supabase, userId } = await getProfile();
  const id = fd.get("id");
  if (typeof id !== "string" || !id) return;
  await supabase.from("coach_conversations").delete().eq("id", id).eq("user_id", userId);
  revalidatePath("/coach");
}
