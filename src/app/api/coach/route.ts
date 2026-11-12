import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { getActiveTargets } from "@/lib/adaptive";
import { aiSpendExceeded, coachDisabled, coachQuotaError, recordAiUsage } from "@/lib/ai-usage";
import { getProfile } from "@/lib/auth";
import { isPremium } from "@/lib/entitlements";
import { buildCoachContext } from "@/lib/coach/context";
import { loadMemories, memoryPromptBlock, updateMemories } from "@/lib/coach/memory";
import { briefsPromptBlock, selectBriefs } from "@/lib/coach/evidence";
import { coachSystemPrompt } from "@/lib/coach/prompt";
import { SAFETY } from "@/lib/coach/safety";
import { generateText, LlmError, streamText, type LlmEvent, type LlmTurn } from "@/lib/llm";
import { ageFromBirthDate } from "@/lib/nutrition";
import { createClient } from "@/lib/supabase/server";
import type { CoachMessage } from "@/lib/types";
import { foldPrompt, planFold, SUMMARY_SYSTEM_PROMPT, type TailMessage } from "@/lib/coach/rolling-summary";

/**
 * Coach chat turn (roadmap 1.6), streamed. Every gate (auth, age, safety,
 * kill switch, quota) runs before the model is called. The response is
 * NDJSON: `{type:"delta",text}` chunks, then `{type:"done",...}` once the
 * exchange is saved, or `{type:"error",error}` if the model fails mid-reply
 * (nothing is saved then). Pre-stream failures are plain JSON `{error}`.
 * Errors are codes (CoachErrorCode); the chat translates them (coach.errors.*).
 */

export const maxDuration = 60;

/** Upper bound on the unsummarised tail loaded (legacy conversations without a watermark). */
const MAX_TAIL = 30;
const MAX_MESSAGE_LEN = 2000;

export type CoachStreamEvent =
  | { type: "delta"; text: string }
  | {
      type: "done";
      conversationId: string;
      restricted: boolean;
      flags: string[];
      /** Titles of the cited evidence briefs the reply was grounded in. */
      sources: string[];
      /** Saved assistant message id (for feedback). */
      replyId: string | null;
    }
  | { type: "error"; error: CoachErrorCode };

export type CoachErrorCode =
  | "signIn"
  | "unavailable"
  | "onboarding"
  | "adultsOnly"
  | "empty"
  | "tooLong"
  | "dailyLimit"
  | "monthlyLimit"
  | "notFound"
  | "saveFailed"
  | "midReply"
  | "invite";

const fail = (error: CoachErrorCode, status: number) => NextResponse.json({ error }, { status });

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return fail("signIn", 401);
  const { userId, profile } = await getProfile();

  if (coachDisabled() || (await aiSpendExceeded(supabase))) return fail("unavailable", 503);

  // The under-18 gate is enforced here, not just in the page UI.
  if (!profile.birth_date) return fail("onboarding", 400);
  if (ageFromBirthDate(profile.birth_date) < SAFETY.minAge) {
    return fail("adultsOnly", 403);
  }

  const body = (await request.json().catch(() => null)) as {
    message?: unknown;
    conversationId?: unknown;
  } | null;
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) return fail("empty", 400);
  if (message.length > MAX_MESSAGE_LEN) {
    return fail("tooLong", 400);
  }

  const premium = await isPremium(supabase, userId);
  const quota = await coachQuotaError(supabase, userId, premium);
  if (quota) return fail(quota, quota === "invite" ? 403 : quota === "unavailable" ? 503 : 429);

  const active = await getActiveTargets(supabase, userId, profile);
  if (!active) return fail("onboarding", 400);

  // Load (and verify ownership of) the conversation, or start a new one.
  let conversationId: string | null = null;
  let summary: string | null = null;
  let summaryThrough: string | null = null;
  if (typeof body?.conversationId === "string" && body.conversationId) {
    const { data: convo } = await supabase
      .from("coach_conversations")
      .select("id, summary, summary_through")
      .eq("id", body.conversationId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!convo) return fail("notFound", 404);
    conversationId = convo.id as string;
    summary = (convo.summary as string | null) ?? null;
    summaryThrough = (convo.summary_through as string | null) ?? null;
  }

  // Everything after the summary's watermark goes verbatim (AUD-10).
  const history: CoachMessage[] = [];
  if (conversationId) {
    let q = supabase.from("coach_messages").select("*").eq("conversation_id", conversationId);
    if (summaryThrough) q = q.gt("created_at", summaryThrough);
    const { data: recent } = await q
      .order("created_at", { ascending: false })
      // An exchange's rows share created_at: user sorts before assistant once reversed.
      .order("role", { ascending: true })
      .limit(MAX_TAIL);
    history.push(...((recent ?? []) as CoachMessage[]).reverse());
  }

  const [{ context, safety }, memories] = await Promise.all([
    buildCoachContext(supabase, userId, profile, active),
    premium ? loadMemories(supabase, userId) : Promise.resolve([]),
  ]);
  if (safety.blocked) return fail("adultsOnly", 403);

  // Deterministic topic router (roadmap 1.6 B): curated, cited briefs for
  // the topics this message touches — the model is told to prefer them
  // over its own memory.
  const briefs = selectBriefs(message);

  const turns: LlmTurn[] = [
    {
      role: "user",
      text: `${context}${memoryPromptBlock(memories)}${summary ? `\n\nEARLIER IN THIS CONVERSATION (summary)\n${summary}` : ""}${briefsPromptBlock(briefs)}\n\n(The conversation starts now. Reply only as the coach.)`,
    },
    { role: "model", text: "Understood — I have their data and I'm ready." },
    ...history.map<LlmTurn>((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      text: m.content,
    })),
    { role: "user", text: message },
  ];

  // Pull the first event before answering so config, rate-limit and
  // provider errors come back as a proper status, not a broken stream.
  const events = streamText({
    systemPrompt: coachSystemPrompt(safety.restricted),
    turns,
    tier: "premium",
    // 0.4: prose stays warm enough, numeric fidelity is measurably better.
    temperature: 0.4,
    signal: request.signal,
  });
  let first: IteratorResult<LlmEvent>;
  try {
    first = await events.next();
  } catch (err) {
    if (err instanceof LlmError) return fail("unavailable", 503);
    throw err;
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (ev: CoachStreamEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(ev)}\n`));
      let reply = "";
      try {
        let usage = null;
        for (let it = first; !it.done; it = await events.next()) {
          if (it.value.type === "delta") {
            reply += it.value.text;
            emit({ type: "delta", text: it.value.text });
          } else {
            usage = it.value.usage;
          }
        }
        if (usage) await recordAiUsage(supabase, userId, "coach", usage);
        reply = reply.trim();

        // Persist the exchange; create the conversation lazily on first message.
        if (!conversationId) {
          const { data: created, error: createError } = await supabase
            .from("coach_conversations")
            .insert({ user_id: userId, title: message.slice(0, 60) })
            .select("id")
            .single();
          if (createError || !created) {
            emit({ type: "error", error: "saveFailed" });
            return;
          }
          conversationId = created.id as string;
        }
        const { data: inserted, error: insertError } = await supabase.from("coach_messages").insert([
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
        ]).select("id, role, content, created_at");
        if (insertError) {
          emit({ type: "error", error: "saveFailed" });
          return;
        }
        await supabase
          .from("coach_conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", conversationId);
        revalidatePath("/coach");

        emit({
          type: "done",
          conversationId,
          restricted: safety.restricted,
          flags: safety.flags,
          sources: briefs.map((b) => b.title),
          replyId: (inserted ?? []).find((m) => m.role === "assistant")?.id ?? null,
        });

        // Long-term memory (premium): learn durable facts from what the user
        // just said. Best-effort, after "done", never fails the exchange.
        if (premium) {
          try {
            await updateMemories(supabase, userId, message, memories);
          } catch (memErr) {
            console.warn("[coach] memory update failed", memErr instanceof Error ? memErr.message : memErr);
          }
        }

        // Rolling memory (AUD-10): fold the oldest whole exchanges into the
        // summary once the unsummarised tail is too long. After "done", on
        // the cheap tier, best-effort: on failure the tail just stays longer.
        const savedRows = ((inserted ?? []) as TailMessage[]).sort((x, y) => (x.role === y.role ? 0 : x.role === "user" ? -1 : 1));
        const plan = planFold<TailMessage>([...(history as unknown as TailMessage[]), ...savedRows]);
        if (plan) {
          try {
            const recap = await generateText({
              systemPrompt: SUMMARY_SYSTEM_PROMPT,
              turns: [{ role: "user", text: foldPrompt(summary, plan.fold) }],
              tier: "economy",
              temperature: 0.3,
              // Generous: thinking tokens come out of the same budget.
              maxOutputTokens: 2048,
            });
            await recordAiUsage(supabase, userId, "coach_summary", recap.usage);
            await supabase
              .from("coach_conversations")
              .update({ summary: recap.text.trim(), summary_through: plan.through })
              .eq("id", conversationId);
          } catch {
            // keep the old summary and watermark
          }
        }
      } catch (err) {
        // Client gone: nothing to tell, and nothing was saved.
        if (!request.signal.aborted) {
          emit({
            type: "error",
            error: "midReply",
          });
          if (!(err instanceof LlmError)) console.error("[coach] stream failed", err);
        }
      } finally {
        try {
          controller.close();
        } catch {
          // already closed by an aborted client
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
