/**
 * Evidence knowledge base for the AI coach (roadmap 1.6 B).
 *
 * Briefs are PR-reviewed content, never model-generated at runtime. Each
 * carries its citations inline and a lastReviewed date — review cadence
 * is every 6 months, or immediately when a cited position stand is
 * superseded. Keep bodies tight (~250–350 words): at most two briefs are
 * inlined into a prompt.
 */
export interface CoachBrief {
  id: string;
  title: string;
  /**
   * Router keywords. ASCII entries match on word boundaries; non-ASCII
   * entries (French/Arabic) match as substrings — see selectBriefs.
   */
  keywords: string[];
  /** YYYY-MM-DD of the last human review of this content. */
  lastReviewed: string;
  body: string;
}
