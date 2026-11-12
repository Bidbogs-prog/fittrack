/**
 * Rolling conversation memory (AUD-10). Every message is either in the
 * summary or sent verbatim, never neither: the coach gets all messages after
 * the summary's watermark, and once that tail grows past FOLD_AT the oldest
 * whole exchanges are folded into the summary and the watermark moves.
 * (Before, only the last 12 messages were sent and the first summary ran at
 * 24, built from those same 12, so messages 1–10 were never seen again.)
 */

/** Messages kept verbatim after a fold. */
export const KEEP_VERBATIM = 12;
/** Fold once the unsummarised tail is longer than this. */
export const FOLD_AT = 18;

export interface TailMessage {
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

/**
 * Which oldest messages to fold into the summary, given the unsummarised
 * tail in chronological order (user before assistant within an exchange).
 * Folds whole exchanges only: both rows of an exchange share created_at, so
 * the watermark never splits one.
 */
export function planFold<T extends TailMessage>(tail: T[]): { fold: T[]; through: string } | null {
  if (tail.length <= FOLD_AT) return null;
  let k = tail.length - KEEP_VERBATIM;
  while (k < tail.length && tail[k].created_at === tail[k - 1].created_at) k++;
  if (k >= tail.length) return null;
  return { fold: tail.slice(0, k), through: tail[k - 1].created_at };
}

export function foldPrompt(summary: string | null, fold: TailMessage[]): string {
  return `${summary ? `Previous summary:\n${summary}\n\n` : ""}Messages to add to it, oldest first:\n${fold
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n")}`;
}

export const SUMMARY_SYSTEM_PROMPT =
  "Update the coach's running summary of this coaching conversation: keep everything still relevant from the previous summary and add the new messages — the user's situation, preferences, questions asked, advice given and any commitments, with their numbers. Max 200 words, plain prose, no preamble.";
