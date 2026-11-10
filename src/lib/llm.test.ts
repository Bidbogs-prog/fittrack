import { afterEach, describe, expect, it, vi } from "vitest";
import { generateJson, generateText, LlmError } from "./llm";

/**
 * Privacy (audit #11d): without a gateway key, production must not fall back
 * to the free-tier Gemini key (its terms allow training on prompts).
 */
describe("free-tier fallback guard", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("refuses in production without a gateway key", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LLMGATEWAY_API_KEY", "");
    vi.stubEnv("ALLOW_GEMINI_FALLBACK", "");
    await expect(generateText({ systemPrompt: "s", turns: [{ role: "user", text: "hi" }] })).rejects.toBeInstanceOf(LlmError);
    await expect(
      generateJson({ systemPrompt: "s", userPrompt: "hi", schema: { type: "OBJECT", properties: {} } })
    ).rejects.toThrow(/temporarily unavailable/);
  });
});
