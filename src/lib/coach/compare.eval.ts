import { mkdirSync, writeFileSync } from "node:fs";
import { randomInt } from "node:crypto";
import path from "node:path";
import { describe, it } from "vitest";
import { FIXTURE_CONTEXT } from "@/lib/coach/eval-fixture";
import { briefsPromptBlock, selectBriefs } from "@/lib/coach/evidence";
import { coachSystemPrompt } from "@/lib/coach/prompt";
import { generateText, type LlmTurn } from "@/lib/llm";

/**
 * Blind A/B quality comparison of two coach models (roadmap 1.6 D). The
 * safety eval is pass/fail; this is for taste. Same production prompt and
 * fixture user as coach.eval.ts; each question's answers are shuffled into
 * A/B and the model mapping goes to a separate key file.
 *
 *   npm run eval:compare
 *   COMPARE_MODELS=model-a,model-b   default gemini-3.6-flash,claude-sonnet-5
 *
 * Output: eval-results/blind-<stamp>.md (read and pick) and
 * eval-results/blind-<stamp>.key.json (don't open until you've picked).
 * Skipped unless COACH_COMPARE=1, so `npm run eval:coach` never runs it.
 */

const QUESTIONS = [
  "How am I doing this week overall?",
  "I'm always starving around 10pm. What can I change?",
  "My weight barely moved this week even though I hit my calories. Should I cut more?",
  "I have a work dinner at a restaurant tonight. How do I handle it?",
  "What should I eat before and after my workout tomorrow morning?",
  "Is it worth doing a refeed day soon?",
  "Help me plan tomorrow's meals so I actually hit my protein.",
  "Can I fit a couple of beers in on Saturday and still lose weight?",
  "I ate a whole plate of msemen yesterday and feel terrible. Did I ruin my progress?",
  "Ramadan starts next month. How should I set up iftar and suhoor for my goal?",
  "Est-ce que je mange assez de fibres ?",
  "واش خاصني نقص من الخبز باش ننقص الوزن؟",
  "I'm thinking of switching to keto. Is that a good idea for me?",
  "I keep losing motivation on weekends. Any tips?",
  "How long until I reach 78 kg at this rate?",
];

async function ask(model: string, message: string): Promise<string> {
  const turns: LlmTurn[] = [
    {
      role: "user",
      text: `${FIXTURE_CONTEXT}${briefsPromptBlock(selectBriefs(message))}\n\n(The conversation starts now. Reply only as the coach.)`,
    },
    { role: "model", text: "Understood — I have their data and I'm ready." },
    { role: "user", text: message },
  ];
  try {
    const { text } = await generateText({ model, systemPrompt: coachSystemPrompt(false), turns, temperature: 0.4 });
    return text.trim();
  } catch (err) {
    return `(no answer: ${err instanceof Error ? err.message : String(err)})`;
  }
}

describe.skipIf(process.env.COACH_COMPARE !== "1")("blind model comparison", () => {
  it("writes the A/B sheet", async () => {
    const [m1, m2] = (process.env.COMPARE_MODELS || "gemini-3.6-flash,claude-sonnet-5").split(",").map((s) => s.trim());
    const key: { question: number; A: string; B: string }[] = [];
    const sections: string[] = [];

    for (const [i, q] of QUESTIONS.entries()) {
      const [r1, r2] = await Promise.all([ask(m1, q), ask(m2, q)]);
      const flip = randomInt(2) === 1;
      key.push({ question: i + 1, A: flip ? m2 : m1, B: flip ? m1 : m2 });
      sections.push(
        `## ${i + 1}. ${q}\n\n### A\n\n${flip ? r2 : r1}\n\n### B\n\n${flip ? r1 : r2}\n\n**Your pick (A / B / tie):** \n\n**Why (optional):** \n\n---\n`
      );
    }

    const dir = path.join(process.cwd(), "eval-results");
    mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const sheet = path.join(dir, `blind-${stamp}.md`);
    writeFileSync(
      sheet,
      `# Coach blind comparison\n\nThe fixture user: 31-year-old man, 84 kg, losing weight on a 2,200 kcal / 150 g protein target. Judge each pair on what you'd want as a paying user: accuracy against their numbers, usefulness, tone, length. Write A, B or tie under each question, then ask for the reveal.\n\n---\n\n${sections.join("\n")}`
    );
    writeFileSync(path.join(dir, `blind-${stamp}.key.json`), JSON.stringify({ models: [m1, m2], key }, null, 2));
    console.log(`\nblind sheet → ${path.relative(process.cwd(), sheet)}`);
  }, 900_000);
});
