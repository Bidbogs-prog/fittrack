/**
 * Voice notes → text. The browser's speech recognition only understands the
 * one language it is set to (the UI locale), so Darija, Arabic or a
 * French/Darija mix failed for anyone on the English UI. Audio now goes to
 * the multimodal model, which handles code-switching.
 */

/** Longest recording the client sends; the server enforces the byte cap. */
export const VOICE_MAX_SECONDS = 60;
export const VOICE_MAX_BYTES = 2 * 1024 * 1024;

const AUDIO_TYPES = ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav", "audio/aac", "audio/x-m4a"];

/** Base MIME type if it's an accepted audio container, else null. */
export function acceptedAudioType(type: string): string | null {
  const base = type.split(";")[0].trim().toLowerCase();
  return AUDIO_TYPES.includes(base) ? base : null;
}

export const TRANSCRIBE_PROMPT = `You transcribe short voice notes from a Moroccan nutrition app. Speakers mix Moroccan Darija, Modern Standard Arabic, French and English, often in one sentence.

Rules:
- Write exactly what was said, in the language it was said. Do not translate.
- Darija and Arabic in Arabic script; French and English words in Latin script (e.g. "كليت جوج croissants و café noir").
- Keep numbers as digits and keep food names, brands and amounts exactly.
- No commentary, quotes or labels. Output only the transcript.
- If there is no intelligible speech, output exactly: <none>`;

/** Model output → transcript, or "" for silence/noise. */
export function cleanTranscript(raw: string): string {
  const text = raw.replace(/^["“«\s]+|["”»\s]+$/g, "").trim();
  return /^<none>$/i.test(text) ? "" : text.slice(0, 1000);
}
