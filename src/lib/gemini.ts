/**
 * Minimal Gemini REST client (no SDK dependency). Server-side only —
 * the API key must never reach the browser, so call this from server
 * actions or route handlers exclusively.
 *
 * Uses the free-tier generateContent endpoint with structured JSON output.
 * Override the model with GEMINI_MODEL (default: gemini-3.6-flash).
 */

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-3.6-flash";

/** Subset of Gemini's OpenAPI-style response schema we use. */
export interface GeminiSchema {
  type: "OBJECT" | "ARRAY" | "STRING" | "NUMBER" | "BOOLEAN";
  properties?: Record<string, GeminiSchema>;
  items?: GeminiSchema;
  required?: string[];
  enum?: string[];
  description?: string;
}

interface GeminiResponse {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    finishReason?: string;
  }[];
  error?: { message?: string };
}

export class GeminiError extends Error {}

/**
 * Ask Gemini for a JSON object matching `schema` and parse it.
 * Pass `image` (base64, no data: prefix) for multimodal prompts — the
 * image is sent before the text part. Throws GeminiError with a
 * user-presentable message on any failure.
 */
export async function generateJson<T>(options: {
  systemPrompt: string;
  userPrompt: string;
  schema: GeminiSchema;
  temperature?: number;
  image?: { mimeType: string; base64: string };
}): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiError(
      "Gemini API key is not configured. Add GEMINI_API_KEY to .env.local and restart the server."
    );
  }

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  let res: Response;
  try {
    res = await fetch(`${GEMINI_ENDPOINT}/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: options.systemPrompt }] },
        contents: [
          {
            role: "user",
            parts: [
              ...(options.image
                ? [{ inlineData: { mimeType: options.image.mimeType, data: options.image.base64 } }]
                : []),
              { text: options.userPrompt },
            ],
          },
        ],
        generationConfig: {
          temperature: options.temperature ?? 0.6,
          responseMimeType: "application/json",
          responseSchema: options.schema,
        },
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new GeminiError("Could not reach Gemini. Check your connection and try again.");
  }

  if (res.status === 429) {
    throw new GeminiError("Gemini free-tier rate limit hit. Wait a minute and try again.");
  }

  const body = (await res.json().catch(() => ({}))) as GeminiResponse;
  if (!res.ok) {
    throw new GeminiError(body.error?.message ?? `Gemini request failed (${res.status}).`);
  }

  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
  if (!text) {
    throw new GeminiError("Gemini returned an empty response. Try again.");
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new GeminiError("Gemini returned malformed output. Try again.");
  }
}
