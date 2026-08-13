import { energyBalance } from "./energy-balance";
import { hydration } from "./hydration";
import { micronutrients } from "./micronutrients";
import { plateaus } from "./plateaus";
import { proteinMacros } from "./protein-macros";
import { rateOfChange } from "./rate-of-change";
import { refeedsDietBreaks } from "./refeeds-diet-breaks";
import type { CoachBrief } from "./types";

export type { CoachBrief } from "./types";

/** Router order is the tie-break: earlier wins on equal keyword hits. */
export const COACH_BRIEFS: CoachBrief[] = [
  energyBalance,
  proteinMacros,
  rateOfChange,
  refeedsDietBreaks,
  plateaus,
  hydration,
  micronutrients,
];

/** At most this many briefs go into one prompt (~700 tokens). */
export const MAX_BRIEFS = 2;

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Deterministic topic router (roadmap 1.6 B): score each brief by keyword
 * hits in the user's message, return the top MAX_BRIEFS with at least one
 * hit. ASCII keywords match whole words (so "fat" doesn't fire on
 * "fatigue"); accented/Arabic keywords match as substrings because \\b is
 * ASCII-only in JS. No model involved — same message, same briefs.
 */
export function selectBriefs(message: string, briefs: CoachBrief[] = COACH_BRIEFS): CoachBrief[] {
  const text = message.toLowerCase();
  const scored = briefs
    .map((brief, order) => {
      let score = 0;
      for (const keyword of brief.keywords) {
        const k = keyword.toLowerCase();
        const ascii = /^[\x20-\x7E]+$/.test(k);
        if (ascii) {
          if (new RegExp(`\\b${escapeRegExp(k)}\\b`).test(text)) score += 1;
        } else if (text.includes(k)) {
          score += 1;
        }
      }
      return { brief, score, order };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order);
  return scored.slice(0, MAX_BRIEFS).map((s) => s.brief);
}

/** Prompt block for the selected briefs, with review dates visible. */
export function briefsPromptBlock(briefs: CoachBrief[]): string {
  if (briefs.length === 0) return "";
  return `\n\nEVIDENCE BRIEFS (curated and cited for this app — when they cover the question, ground your answer in them over general memory, and mention the source naturally when you lean on a specific finding)\n${briefs
    .map((b) => `--- ${b.title} (last reviewed ${b.lastReviewed}) ---\n${b.body}`)
    .join("\n\n")}`;
}
