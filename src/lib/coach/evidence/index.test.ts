import { describe, expect, it } from "vitest";
import { COACH_BRIEFS, MAX_BRIEFS, briefsPromptBlock, selectBriefs } from "./index";

describe("COACH_BRIEFS content contract", () => {
  it("every brief has id, title, keywords, a review date and cited sources", () => {
    for (const brief of COACH_BRIEFS) {
      expect(brief.id).toMatch(/^[a-z0-9-]+$/);
      expect(brief.title.length).toBeGreaterThan(0);
      expect(brief.keywords.length).toBeGreaterThan(3);
      expect(brief.lastReviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(brief.body).toMatch(/Sources:/);
    }
  });

  it("ids are unique", () => {
    const ids = COACH_BRIEFS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("selectBriefs", () => {
  it("routes a protein question to the protein brief", () => {
    const briefs = selectBriefs("How much protein should I eat per day?");
    expect(briefs[0]?.id).toBe("protein-macros");
  });

  it("routes refeed questions to refeeds", () => {
    const briefs = selectBriefs("Should I take a diet break or a refeed?");
    expect(briefs.map((b) => b.id)).toContain("refeeds-diet-breaks");
  });

  it("routes a stall question to plateaus", () => {
    const briefs = selectBriefs("My weight is stuck, I think I hit a plateau");
    expect(briefs[0]?.id).toBe("plateaus");
  });

  it("returns nothing for smalltalk", () => {
    expect(selectBriefs("hello, how are you today?")).toEqual([]);
  });

  it("never returns more than MAX_BRIEFS", () => {
    const briefs = selectBriefs(
      "calories protein carbs fat water vitamins plateau refeed rate per week deficit"
    );
    expect(briefs.length).toBe(MAX_BRIEFS);
  });

  it("matches ASCII keywords on word boundaries only", () => {
    // "fatigue" must not fire the "fat" keyword.
    const briefs = selectBriefs("I feel fatigue lately");
    expect(briefs.map((b) => b.id)).not.toContain("protein-macros");
  });

  it("matches French and Arabic keywords", () => {
    expect(selectBriefs("Combien de protéines par jour ?").map((b) => b.id)).toContain(
      "protein-macros"
    );
    expect(selectBriefs("كم من الماء يجب أن أشرب؟").map((b) => b.id)).toContain("hydration");
  });

  it("is deterministic", () => {
    const q = "protein and calories on a cut";
    expect(selectBriefs(q)).toEqual(selectBriefs(q));
  });
});

describe("briefsPromptBlock", () => {
  it("is empty with no briefs and includes titles + review dates otherwise", () => {
    expect(briefsPromptBlock([])).toBe("");
    const block = briefsPromptBlock([COACH_BRIEFS[0]]);
    expect(block).toContain(COACH_BRIEFS[0].title);
    expect(block).toContain(COACH_BRIEFS[0].lastReviewed);
  });
});
