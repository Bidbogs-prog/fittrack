import { type NextRequest, NextResponse } from "next/server";
import { safeRedirectPath } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeRedirectPath(searchParams.get("next"), "/dashboard");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    // Same origin as this request, which is where the session cookie was
      // just set. Never a forwarded header: x-forwarded-host is client-
      // controllable on some proxies and sent people off-site (AUD-02).
      if (!error) return NextResponse.redirect(new URL(next, origin));
  }

  const message =
    searchParams.get("error_description") ?? "Sign-in failed or was cancelled. Please try again.";
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(message)}`);
}