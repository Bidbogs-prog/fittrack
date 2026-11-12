import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { exchangeCodeForSession: async (code: string) => ({ error: code === "bad" ? new Error("x") : null }) } }),
}));
afterEach(() => vi.unstubAllEnvs());

async function callback(url: string, headers: Record<string, string> = {}) {
  vi.stubEnv("NODE_ENV", "production");
  const { GET } = await import("@/app/auth/callback/route");
  const { NextRequest } = await import("next/server");
  return (await GET(new NextRequest(url, { headers }))).headers.get("location");
}

it("AUD-02: a forged x-forwarded-host can't send the user off-site after sign-in", async () => {
  const loc = await callback("https://app.example/auth/callback?code=ok&next=/coach", { "x-forwarded-host": "attacker.invalid" });
  expect(loc).toBe("https://app.example/coach");
});

it("AUD-02: unsafe next falls back to the dashboard on the same origin", async () => {
  expect(await callback("https://app.example/auth/callback?code=ok&next=//attacker.invalid")).toBe("https://app.example/dashboard");
});

it("AUD-02: a failed exchange goes to login on the same origin", async () => {
  expect(await callback("https://app.example/auth/callback?code=bad", { "x-forwarded-host": "attacker.invalid" })).toMatch(/^https:\/\/app\.example\/login\?error=/);
});
