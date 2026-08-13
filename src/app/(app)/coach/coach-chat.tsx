"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChatCircleText, PaperPlaneRight } from "@phosphor-icons/react";
import { track } from "@/lib/analytics";
import type { CoachMessage } from "@/lib/types";
import { sendCoachMessage } from "./actions";

interface LocalMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const STARTERS = [
  "How am I doing this week?",
  "What should I change to hit my protein target?",
  "Is my weight trend on track for my goal?",
];

/**
 * The coach thread (roadmap 1.6 A). Server-rendered history seeds local
 * state; sends append optimistically and the reply lands via the server
 * action's return value. key={conversationId} on the parent resets state
 * when the user switches conversations.
 */
export function CoachChat({
  conversationId,
  initialMessages,
}: {
  conversationId: string | null;
  initialMessages: CoachMessage[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<LocalMessage[]>(
    initialMessages.map((m) => ({ id: m.id, role: m.role, content: m.content }))
  );
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // The action may create the conversation on first send.
  const convoRef = useRef<string | null>(conversationId);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, pending]);

  function send(text: string) {
    const message = text.trim();
    if (!message || pending) return;
    setError(null);
    setInput("");
    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, role: "user", content: message },
    ]);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("message", message);
      if (convoRef.current) fd.set("conversation_id", convoRef.current);
      const res = await sendCoachMessage(fd);
      if (res.data == null) {
        setError(res.error);
        // Put the failed message back in the box so nothing is lost.
        setMessages((prev) => prev.slice(0, -1));
        setInput(message);
        return;
      }
      const isNew = convoRef.current == null;
      convoRef.current = res.data.conversationId;
      setMessages((prev) => [
        ...prev,
        { id: `local-${Date.now()}-r`, role: "assistant", content: res.data.reply },
      ]);
      track("coach_message_sent", { restricted: res.data.restricted });
      for (const flag of res.data.flags) {
        track("coach_guardrail_triggered", { flag });
      }
      // Reflect the new conversation in the URL + chip row without
      // remounting the thread mid-conversation.
      if (isNew) router.replace(`/coach?c=${res.data.conversationId}`, { scroll: false });
    });
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-ink-800 bg-ink-900/60">
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
        {messages.length === 0 && !pending ? (
          <div className="flex h-full flex-col items-center justify-center gap-5 py-10 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-lime/10 ring-1 ring-inset ring-lime/25">
              <ChatCircleText weight="fill" className="size-6 text-lime" />
            </span>
            <div>
              <h2 className="font-display text-lg font-semibold text-paper">
                Ask about your actual numbers
              </h2>
              <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-paper-dim">
                The coach sees your targets, your last two weeks of logging, your weight trend
                and your training — so ask something specific to you.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="btn-press rounded-lg border border-ink-700 px-3 py-2 text-xs font-medium text-paper-dim transition-colors hover:border-lime/50 hover:text-lime"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed sm:max-w-[75%] ${
                  m.role === "user"
                    ? "rounded-br-md bg-lime/10 text-paper ring-1 ring-inset ring-lime/20"
                    : "rounded-bl-md bg-ink-800/80 text-paper-dim"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))
        )}
        {pending && (
          <div className="flex justify-start" aria-live="polite" aria-busy="true">
            <div className="space-y-2 rounded-2xl rounded-bl-md bg-ink-800/80 px-4 py-3">
              <p className="text-xs text-paper-mute">Reading your data…</p>
              {[120, 180, 90].map((w, i) => (
                <div
                  key={i}
                  className="h-2.5 animate-pulse rounded bg-ink-700"
                  style={{ width: w, animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {error && (
        <p role="alert" className="border-t border-ink-800 px-5 py-2.5 text-sm text-danger">
          {error}
        </p>
      )}

      <form
        className="flex items-end gap-2 border-t border-ink-800 p-3 sm:p-4"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          maxLength={2000}
          placeholder="Ask your coach…"
          aria-label="Message the coach"
          className="field max-h-40 min-h-11 flex-1 resize-none"
        />
        <button
          type="submit"
          disabled={pending || input.trim().length === 0}
          aria-label="Send"
          className="btn-press grid size-11 shrink-0 place-items-center rounded-xl bg-lime text-lime-ink hover:bg-lime-deep disabled:cursor-not-allowed disabled:opacity-40"
        >
          <PaperPlaneRight weight="fill" className="size-4.5" />
        </button>
      </form>

      <p className="border-t border-ink-800 px-5 py-2 text-center text-[11px] text-paper-mute">
        The coach is an AI, not a doctor — nothing here is medical advice. For health concerns,
        talk to a professional.
      </p>
    </section>
  );
}
