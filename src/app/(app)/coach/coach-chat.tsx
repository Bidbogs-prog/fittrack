"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Composer } from "@/components/orbit/composer";
import { track } from "@/lib/analytics";
import { ThumbsDown, ThumbsUp } from "@phosphor-icons/react";
import type { CoachStreamEvent } from "@/app/api/coach/route";
import { ThinkingOrbit } from "@/components/orbit/thinking";
import { rateCoachMessage } from "./actions";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: string[];
  /** Saved assistant message id; feedback needs it. */
  dbId?: string;
  feedback?: "up" | "down" | null;
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
 * While the coach works: a small orbit (the dial's ring with a flame arc and
 * a satellite dot) and status lines that step through what the server is
 * actually doing — reading logs, checking targets, pulling evidence, writing.
 */
function CoachThinking() {
  const t = useTranslations("coach");
  return (
    <ThinkingOrbit
      className="py-1.5"
      steps={[t("reading"), t("thinkingTargets"), t("thinkingEvidence"), t("thinkingWriting")]}
    />
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
  const [pending, setPending] = useState(false);
  const convoRef = useRef<string | null>(conversationId);
  const localSeq = useRef(1);
  const anchorRef = useRef<string | null>(initialPrompt ? "local-0" : null);
  const sentInitial = useRef(false);

  const errorText = (code: string) => (t.has(`errors.${code}`) ? t(`errors.${code}`) : t("offline"));

  function rate(m: ChatMessage, rating: "up" | "down") {
    if (!m.dbId) return;
    const next = m.feedback === rating ? null : rating;
    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, feedback: next } : x)));
    if (next) track("coach_feedback", { rating: next });
    void rateCoachMessage(m.dbId, next).catch(() => {});
  }

  async function request(message: string) {
    setPending(true);
    const replyId = `local-${++localSeq.current}`;
    let started = false;
    let finished = false;
    const fail = (msg: string) => {
      setError(msg);
      anchorRef.current = null;
      // Drop the partial reply and the unsent turn; nothing was saved server-side.
      setMessages((prev) => prev.filter((m) => m.id !== replyId).slice(0, -1));
    };
    const onEvent = (ev: CoachStreamEvent) => {
      if (ev.type === "delta") {
        if (!started) {
          started = true;
          setMessages((prev) => [...prev, { id: replyId, role: "assistant", content: ev.text, sources: [] }]);
        } else {
          setMessages((prev) => prev.map((m) => (m.id === replyId ? { ...m, content: m.content + ev.text } : m)));
        }
      } else if (ev.type === "error") {
        finished = true;
        fail(errorText(ev.error));
      } else {
        finished = true;
        const isNew = convoRef.current == null;
        convoRef.current = ev.conversationId;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === replyId ? { ...m, sources: ev.sources, dbId: ev.replyId ?? undefined, feedback: null } : m
          )
        );
        track("coach_message_sent", { restricted: ev.restricted });
        for (const flag of ev.flags) track("coach_guardrail_triggered", { flag });
        if (isNew) router.replace(`/coach?c=${ev.conversationId}`, { scroll: false });
      }
    };

    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, conversationId: convoRef.current }),
      });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        fail(body?.error ? errorText(body.error) : t("offline"));
        return;
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) if (line.trim()) onEvent(JSON.parse(line) as CoachStreamEvent);
      }
      if (!finished) fail(t("offline"));
    } catch {
      if (!finished) fail(t("offline"));
    } finally {
      setPending(false);
    }
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
                  {pending && m.id === messages[messages.length - 1]?.id && (
                    <span aria-hidden className="coach-caret" />
                  )}
                </p>
                {m.sources.length > 0 && (
                  <p className="mt-1.5 text-[11px] text-paper-mute">
                    {t("sources")}: {m.sources.join(" · ")}
                  </p>
                )}
                {m.dbId && (
                  <div className="mt-1 flex gap-1 text-paper-mute">
                    {(["up", "down"] as const).map((r) => {
                      const Icon = r === "up" ? ThumbsUp : ThumbsDown;
                      const on = m.feedback === r;
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => rate(m, r)}
                          aria-pressed={on}
                          aria-label={t(r === "up" ? "helpful" : "notHelpful")}
                          className={`grid size-8 place-items-center rounded-full hover:bg-ink-800 hover:text-paper ${on ? "text-flame" : ""}`}
                        >
                          <Icon weight={on ? "fill" : "regular"} className="size-4" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )
          )
        )}
        {pending && messages[messages.length - 1]?.role === "user" && <CoachThinking />}
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
