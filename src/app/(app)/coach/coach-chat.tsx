"use client";

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Composer } from "@/components/orbit/composer";
import { track } from "@/lib/analytics";
import { sendCoachMessage } from "./actions";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: string[];
}

/** Coach replies are plain text; **bold** spans get the flame emphasis. */
function Rich({ text }: { text: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <b key={i} className="font-medium text-flame-glow">
            {part}
          </b>
        ) : (
          part
        )
      )}
    </>
  );
}

/**
 * The coach thread (roadmap 1.6 A), merged into the orbit: user turns are
 * paper bubbles, the coach answers in plain text, and the docked composer
 * sends here instead of parsing meals. Server-rendered history seeds local
 * state; key={conversationId} on the parent resets it per conversation.
 * `initialPrompt` (from ?q=, e.g. Today's "See meal ideas") is sent once
 * on mount.
 */
export function CoachChat({
  conversationId,
  initialMessages,
  initialPrompt,
}: {
  conversationId: string | null;
  initialMessages: ChatMessage[];
  initialPrompt: string | null;
}) {
  const t = useTranslations("coach");
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    initialPrompt
      ? [...initialMessages, { id: "local-0", role: "user", content: initialPrompt, sources: [] }]
      : initialMessages
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const convoRef = useRef<string | null>(conversationId);
  const localSeq = useRef(1);
  const anchorRef = useRef<string | null>(initialPrompt ? "local-0" : null);
  const sentInitial = useRef(false);

  function request(message: string) {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("message", message);
      if (convoRef.current) fd.set("conversation_id", convoRef.current);
      let res: Awaited<ReturnType<typeof sendCoachMessage>>;
      try {
        res = await sendCoachMessage(fd);
      } catch {
        res = { data: null, error: t("offline") };
      }
      if (res.data == null) {
        setError(res.error);
        anchorRef.current = null;
        setMessages((prev) => prev.slice(0, -1));
        return;
      }
      const isNew = convoRef.current == null;
      convoRef.current = res.data.conversationId;
      const reply = res.data;
      setMessages((prev) => [
        ...prev,
        {
          id: `local-${++localSeq.current}`,
          role: "assistant",
          content: reply.reply,
          sources: reply.sources,
        },
      ]);
      track("coach_message_sent", { restricted: reply.restricted });
      for (const flag of reply.flags) track("coach_guardrail_triggered", { flag });
      if (isNew) router.replace(`/coach?c=${reply.conversationId}`, { scroll: false });
    });
  }

  function send(text: string) {
    const message = text.trim();
    if (!message || pending) return;
    setError(null);
    const id = `local-${++localSeq.current}`;
    anchorRef.current = id;
    setMessages((prev) => [...prev, { id, role: "user", content: message, sources: [] }]);
    request(message);
  }

  // A prompt handed over from Today goes out once.
  useEffect(() => {
    if (!initialPrompt || sentInitial.current) return;
    sentInitial.current = true;
    request(initialPrompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Open on the latest turn; after a send, pin the new turn under the header.
  useLayoutEffect(() => {
    const anchor = anchorRef.current
      ? document.querySelector<HTMLElement>(`[data-msg="${anchorRef.current}"]`)
      : null;
    if (anchor && messages[messages.length - 1]?.id === anchorRef.current) {
      anchor.scrollIntoView({ block: "start" });
    } else if (!anchorRef.current) {
      window.scrollTo({ top: document.documentElement.scrollHeight });
    }
  }, [messages]);

  const starters = [t("starter1"), t("starter2"), t("starter3")];

  return (
    <>
      <div className="flex flex-1 flex-col gap-3 px-[18px] pt-3.5 pb-4 lg:px-9">
        {messages.length === 0 && !pending ? (
          <div className="flex flex-col items-start gap-2 py-8">
            <h2 className="font-display text-xl font-semibold tracking-tight text-paper">{t("emptyTitle")}</h2>
            <p className="max-w-md text-sm leading-relaxed text-paper-dim">{t("emptyBody")}</p>
          </div>
        ) : (
          messages.map((m) =>
            m.role === "user" ? (
              <p
                key={m.id}
                data-msg={m.id}
                dir="auto"
                className="max-w-[80%] scroll-mt-24 self-end whitespace-pre-wrap rounded-[18px] rounded-ee-md bg-paper px-3.5 py-2.5 text-sm text-ink-950"
              >
                {m.content}
              </p>
            ) : (
              <div key={m.id} data-msg={m.id} className="max-w-[92%] lg:ms-0">
                <p dir="auto" className="whitespace-pre-wrap text-sm leading-relaxed text-paper">
                  <Rich text={m.content} />
                </p>
                {m.sources.length > 0 && (
                  <p className="mt-1.5 text-[11px] text-paper-mute">
                    {t("sources")}: {m.sources.join(" · ")}
                  </p>
                )}
              </div>
            )
          )
        )}
        {pending && (
          <div aria-live="polite" aria-busy="true" className="flex flex-col gap-2 py-1">
            <p className="text-xs text-paper-mute">{t("reading")}</p>
            {[180, 240, 120].map((w, i) => (
              <span
                key={i}
                className="h-2.5 animate-pulse rounded bg-ink-800"
                style={{ width: w, animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
        )}
        {error && (
          <p role="alert" className="rounded-xl border border-danger/30 bg-danger/[0.08] px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        <p className="mt-auto pt-4 text-[11px] leading-relaxed text-paper-mute">{t("disclaimer")}</p>
      </div>

      <div className="lg:px-9">
        <Composer
          mode="coach"
          onSend={send}
          sending={pending}
          suggestions={messages.length === 0 ? starters : undefined}
        />
      </div>
    </>
  );
}
