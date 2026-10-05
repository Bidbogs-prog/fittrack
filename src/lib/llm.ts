/**
 * Server-only LLM client (roadmap 1.6 D). Talks to LLM Gateway's
 * OpenAI-compatible chat API so the model is an env var, not code:
 *
 *   LLMGATEWAY_API_KEY            required to use the gateway
 *   LLMGATEWAY_MODEL              premium model (coach replies), default gemini-3.6-flash
 *   LLMGATEWAY_MODEL_ECONOMY      cheap model (summaries), default gemini-3.1-flash-lite
 *   LLMGATEWAY_BASE_URL           optional, default https://api.llmgateway.io/v1
 *   LLMGATEWAY_REASONING_EFFORT   low | medium | high for reasoning models, default low
 *
 * Without LLMGATEWAY_API_KEY it falls back to the existing Gemini client
 * (gemini.ts), non-streaming and without token counts, so nothing breaks
 * before the gateway is configured. Never import this from client code.
 */

import {
  GeminiError,
  generateJson as geminiGenerateJson,
  generateText as geminiGenerateText,
  type GeminiSchema,
  type GeminiTurn,
} from "@/lib/gemini";

const DEFAULT_BASE_URL = "https://api.llmgateway.io/v1";
/** The model the eval set already passes on; swap via env once a candidate beats it. */
const DEFAULT_MODEL = "gemini-3.6-flash";
const DEFAULT_ECONOMY_MODEL = "gemini-3.1-flash-lite";
const TIMEOUT_MS = 60_000;

export type LlmTier = "premium" | "economy";

/** Same role vocabulary as gemini.ts so call sites can switch without remapping. */
export type LlmTurn = GeminiTurn;

export interface LlmUsage {
  provider: "llmgateway" | "gemini";
  model: string;
  inputTokens: number | null;
  cachedTokens: number | null;
  outputTokens: number | null;
  /** Only when the provider reports it; otherwise derived later from token counts. */
  costUsd: number | null;
}

export type LlmEvent = { type: "delta"; text: string } | { type: "usage"; usage: LlmUsage };

/** Message is safe to show the user; details go to the server log. */
export class LlmError extends Error {}

export interface LlmRequest {
  systemPrompt: string;
  turns: LlmTurn[];
  tier?: LlmTier;
  /** Exact gateway model id; overrides tier (e.g. a fixed eval judge). */
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  signal?: AbortSignal;
  /** Inline image sent with the last user turn (base64, no data: prefix). */
  image?: { mimeType: string; base64: string };
  /** Ask for JSON matching this schema (OpenAI json_schema response format). */
  schema?: GeminiSchema;
}

interface GatewayUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number };
  cost?: number;
}

interface GatewayChunk {
  choices?: {
    delta?: { content?: string | null };
    message?: { content?: string | null };
    finish_reason?: string | null;
  }[];
  usage?: GatewayUsage | null;
  model?: string;
  error?: { message?: string };
}

/** True once the gateway is configured; false means the Gemini fallback is in use. */
export function gatewayEnabled(): boolean {
  return Boolean(process.env.LLMGATEWAY_API_KEY);
}

export function modelFor(tier: LlmTier): string {
  if (!gatewayEnabled()) return process.env.GEMINI_MODEL || "gemini-3.6-flash";
  return tier === "economy"
    ? process.env.LLMGATEWAY_MODEL_ECONOMY || DEFAULT_ECONOMY_MODEL
    : process.env.LLMGATEWAY_MODEL || DEFAULT_MODEL;
}

function toUsage(model: string, u: GatewayUsage | null | undefined): LlmUsage {
  return {
    provider: "llmgateway",
    model,
    inputTokens: u?.prompt_tokens ?? null,
    cachedTokens: u?.prompt_tokens_details?.cached_tokens ?? null,
    outputTokens: u?.completion_tokens ?? null,
    costUsd: typeof u?.cost === "number" ? u.cost : null,
  };
}

/** Gemini's OpenAPI-style schema (upper-case types) → standard JSON Schema. */
function toJsonSchema(s: GeminiSchema): Record<string, unknown> {
  return {
    type: s.type.toLowerCase(),
    ...(s.description ? { description: s.description } : {}),
    ...(s.enum ? { enum: s.enum } : {}),
    ...(s.properties
      ? { properties: Object.fromEntries(Object.entries(s.properties).map(([k, v]) => [k, toJsonSchema(v)])) }
      : {}),
    ...(s.required ? { required: s.required } : {}),
    ...(s.items ? { items: toJsonSchema(s.items) } : {}),
  };
}

async function gatewayFetch(req: LlmRequest, stream: boolean): Promise<{ res: Response; model: string }> {
  const model = req.model ?? modelFor(req.tier ?? "premium");
  // Thinking tokens come out of max_tokens; unbounded thinking truncated
  // coach replies in the eval, so keep it low unless overridden.
  const effort = process.env.LLMGATEWAY_REASONING_EFFORT || "low";
  const signal = req.signal
    ? AbortSignal.any([req.signal, AbortSignal.timeout(TIMEOUT_MS)])
    : AbortSignal.timeout(TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${process.env.LLMGATEWAY_BASE_URL || DEFAULT_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.LLMGATEWAY_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: req.systemPrompt },
          ...req.turns.map((t, i) => {
            const role = t.role === "model" ? "assistant" : "user";
            if (!req.image || i !== req.turns.length - 1 || role !== "user") return { role, content: t.text };
            return {
              role,
              content: [
                { type: "image_url", image_url: { url: `data:${req.image.mimeType};base64,${req.image.base64}` } },
                { type: "text", text: t.text },
              ],
            };
          }),
        ],
        ...(req.schema
          ? {
              response_format: {
                type: "json_schema",
                json_schema: { name: "result", schema: toJsonSchema(req.schema), strict: false },
              },
            }
          : {}),
        temperature: req.temperature ?? 0.6,
        max_tokens: req.maxOutputTokens ?? 4096,
        ...(effort ? { reasoning_effort: effort } : {}),
        ...(stream ? { stream: true, stream_options: { include_usage: true } } : {}),
      }),
      signal,
    });
  } catch (err) {
    if (req.signal?.aborted) throw err;
    throw new LlmError("Could not reach the AI provider. Check your connection and try again.");
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as GatewayChunk;
    console.error(`[llm] ${model} ${res.status}: ${body.error?.message ?? "no body"}`);
    if (res.status === 429) throw new LlmError("AI provider rate limit hit. Wait a moment and try again.");
    if (res.status === 401 || res.status === 403) {
      throw new LlmError("The AI provider rejected the API key. Check LLMGATEWAY_API_KEY.");
    }
    if (res.status === 402) throw new LlmError("AI features are temporarily unavailable. Try again later.");
    throw new LlmError(`The AI provider failed (${res.status}). Try again.`);
  }
  return { res, model };
}

/** Streams reply text as it is generated, then one usage event at the end. */
export async function* streamText(req: LlmRequest): AsyncGenerator<LlmEvent> {
  if (!gatewayEnabled()) {
    const model = modelFor(req.tier ?? "premium");
    let text: string;
    try {
      text = await geminiGenerateText(req);
    } catch (err) {
      if (err instanceof GeminiError) throw new LlmError(err.message);
      throw err;
    }
    yield { type: "delta", text };
    yield {
      type: "usage",
      usage: { provider: "gemini", model, inputTokens: null, cachedTokens: null, outputTokens: null, costUsd: null },
    };
    return;
  }

  const { res, model } = await gatewayFetch(req, true);
  if (!res.body) throw new LlmError("The AI provider returned an empty response. Try again.");

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let usage: GatewayUsage | null = null;
  let any = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const data = line.startsWith("data:") ? line.slice(5).trim() : "";
      if (!data || data === "[DONE]") continue;
      let chunk: GatewayChunk;
      try {
        chunk = JSON.parse(data) as GatewayChunk;
      } catch {
        continue;
      }
      if (chunk.error) {
        console.error(`[llm] ${model} stream error: ${chunk.error.message}`);
        throw new LlmError("The AI provider failed mid-reply. Try again.");
      }
      if (chunk.usage) usage = chunk.usage;
      if (chunk.choices?.[0]?.finish_reason === "length") {
        console.warn(`[llm] ${model} hit max_tokens; reply truncated`);
      }
      const text = chunk.choices?.[0]?.delta?.content;
      if (text) {
        any = true;
        yield { type: "delta", text };
      }
    }
  }
  if (!any) throw new LlmError("The AI provider returned an empty response. Try again.");
  yield { type: "usage", usage: toUsage(model, usage) };
}

/** Whole-reply generation (summaries, evals). */
export async function generateText(req: LlmRequest): Promise<{ text: string; usage: LlmUsage }> {
  if (!gatewayEnabled()) {
    let text = "";
    let usage: LlmUsage | null = null;
    for await (const ev of streamText(req)) {
      if (ev.type === "delta") text += ev.text;
      else usage = ev.usage;
    }
    return { text, usage: usage! };
  }

  const { res, model } = await gatewayFetch(req, false);
  const body = (await res.json().catch(() => ({}))) as GatewayChunk;
  const text = body.choices?.[0]?.message?.content;
  if (body.choices?.[0]?.finish_reason === "length") {
    console.warn(`[llm] ${model} hit max_tokens; reply truncated`);
  }
  if (!text) throw new LlmError("The AI provider returned an empty response. Try again.");
  return { text, usage: toUsage(model, body.usage) };
}

/**
 * Structured output: JSON matching `schema`, parsed. Supports one inline
 * image. Falls back to gemini.ts (free tier, no token counts) without a
 * gateway key. Throws LlmError with a user-presentable message.
 */
export async function generateJson<T>(
  req: Omit<LlmRequest, "schema" | "turns"> & { userPrompt: string; schema: GeminiSchema }
): Promise<{ data: T; usage: LlmUsage }> {
  if (!gatewayEnabled()) {
    try {
      const data = await geminiGenerateJson<T>({
        systemPrompt: req.systemPrompt,
        userPrompt: req.userPrompt,
        schema: req.schema,
        temperature: req.temperature,
        image: req.image,
      });
      return {
        data,
        usage: {
          provider: "gemini",
          model: modelFor(req.tier ?? "premium"),
          inputTokens: null,
          cachedTokens: null,
          outputTokens: null,
          costUsd: null,
        },
      };
    } catch (err) {
      if (err instanceof GeminiError) throw new LlmError(err.message);
      throw err;
    }
  }

  const { text, usage } = await generateText({
    ...req,
    turns: [{ role: "user", text: req.userPrompt }],
  });
  // Some providers wrap JSON in a code fence despite response_format.
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  try {
    return { data: JSON.parse(json) as T, usage };
  } catch {
    console.error(`[llm] ${usage.model} returned unparseable JSON: ${text.slice(0, 200)}`);
    throw new LlmError("The AI returned malformed output. Try again.");
  }
}
