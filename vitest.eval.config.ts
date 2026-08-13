import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Config for the coach red-team eval (`npm run eval:coach`) — separate
 * from vitest.config.ts because eval files hit the live Gemini API
 * (needs GEMINI_API_KEY, costs a few cents, takes minutes on the
 * free-tier rate limit) and must never run inside plain `npm test`.
 */
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    include: ["src/**/*.eval.ts"],
    testTimeout: 180_000,
    hookTimeout: 180_000,
    // One file, sequential cases — keeps us under the API rate limit.
    fileParallelism: false,
  },
});
