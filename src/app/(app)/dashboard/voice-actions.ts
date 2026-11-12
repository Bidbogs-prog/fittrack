"use server";

import { requireUser } from "@/lib/auth";
import { featureQuotaError, recordAiUsage } from "@/lib/ai-usage";
import { isPremium } from "@/lib/entitlements";
import { generateText, LlmError } from "@/lib/llm";
import { acceptedAudioType, cleanTranscript, TRANSCRIBE_PROMPT, VOICE_MAX_BYTES } from "@/lib/voice";

/** Transcribe a recorded voice note (field "audio") in whatever language was spoken. */
export async function transcribeVoice(formData: FormData): Promise<{ text: string; error: null } | { text: null; error: string }> {
  const { supabase, userId } = await requireUser();
  const audio = formData.get("audio");
  if (!(audio instanceof File) || audio.size === 0) return { text: null, error: "empty" };
  const mimeType = acceptedAudioType(audio.type);
  if (!mimeType) return { text: null, error: "format" };
  if (audio.size > VOICE_MAX_BYTES) return { text: null, error: "tooLong" };

  const quota = await featureQuotaError(supabase, userId, "voice", await isPremium(supabase, userId));
  if (quota) return { text: null, error: quota };

  try {
    const res = await generateText({
      systemPrompt: TRANSCRIBE_PROMPT,
      turns: [{ role: "user", text: "Transcribe this voice note." }],
      audio: { mimeType, base64: Buffer.from(await audio.arrayBuffer()).toString("base64") },
      tier: "economy",
      temperature: 0,
      maxOutputTokens: 1024,
    });
    await recordAiUsage(supabase, userId, "voice", res.usage);
    const text = cleanTranscript(res.text);
    return text ? { text, error: null } : { text: null, error: "empty" };
  } catch (err) {
    if (err instanceof LlmError) return { text: null, error: err.message };
    throw err;
  }
}
