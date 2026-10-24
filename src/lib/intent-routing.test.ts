import { describe, expect, it } from "vitest";
import { looksLikeQuestion } from "./intent-routing";

/**
 * Composer routing — equivalence partitioning across three classes and three
 * languages. Partition C (diary edits phrased as questions) is the regression
 * for DR-005: "can you remove the rice?" must not be sent to the coach.
 */
describe("looksLikeQuestion", () => {
  describe("A: questions → coach", () => {
    it.each([
      "how much protein do I need?",
      "What should I eat for dinner",
      "am i eating enough fibre",
      "is rice bad at night?",
      "pourquoi je stagne ?",
      "combien de protéines par jour",
      "واش الخبز كيسمن؟",
      "شنو ناكل فالعشا",
    ])("%s", (text) => expect(looksLikeQuestion(text)).toBe(true));
  });

  describe("B: meal reports → meal parser", () => {
    it.each([
      "2 eggs and toast",
      "had a banana",
      "chicken tagine with bread",
      "deux bols de harira",
      "kliit msemen o atay",
    ])("%s", (text) => expect(looksLikeQuestion(text)).toBe(false));
  });

  describe("C: diary edits phrased as questions → meal parser (DR-005)", () => {
    it.each([
      "can you remove the rice?",
      "could you delete my breakfast?",
      "can you add a coffee?",
      "est-ce que tu peux supprimer le pain ?",
      "tu peux enlever le riz ?",
      "peux-tu ajouter un café ?",
      "واش تقدر تحيد الخبز؟",
    ])("%s", (text) => expect(looksLikeQuestion(text)).toBe(false));
  });

  describe("boundaries", () => {
    it("question mark with trailing whitespace still counts", () => {
      expect(looksLikeQuestion("enough protein today?   ")).toBe(true);
    });
    it("Arabic question mark counts", () => {
      expect(looksLikeQuestion("الخبز مزيان؟")).toBe(true);
    });
    it("verb inside another word is not a diary verb", () => {
      // "address" contains "add" but not as a word
      expect(looksLikeQuestion("what's the best address for a cheap gym?")).toBe(true);
    });
  });
});
