import { defineConfig, devices } from "@playwright/test";

/**
 * System tests (docs/qa/test-strategy.md §2). The app runs as a production
 * build; the AI provider is replaced by a local mock (e2e/mock-llm.ts) via
 * LLMGATEWAY_BASE_URL, so runs are deterministic and free.
 *
 * Public and accessibility specs need no backend. Signed-in specs need a
 * test Supabase project (NEXT_PUBLIC_SUPABASE_* of a non-production project)
 * plus E2E_EMAIL / E2E_PASSWORD of an invite-cleared, onboarded test user;
 * without them they're skipped.
 */
const PORT = 3100;
const MOCK_PORT = 3199;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
    { name: "desktop-chrome", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: [
    {
      command: `node e2e/mock-llm.mjs ${MOCK_PORT}`,
      port: MOCK_PORT,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `npm run build && npx next start -p ${PORT}`,
      port: PORT,
      timeout: 240_000,
      reuseExistingServer: !process.env.CI,
      env: {
        LLMGATEWAY_API_KEY: "e2e-mock",
        LLMGATEWAY_BASE_URL: `http://localhost:${MOCK_PORT}/v1`,
        AI_DAILY_SPEND_LIMIT_USD: "0",
        BETA_INVITE_ONLY: process.env.BETA_INVITE_ONLY ?? "1",
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "e2e-placeholder",
        NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
        NEXT_TELEMETRY_DISABLED: "1",
      },
    },
  ],
});
