import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  // Resolve against our origin and reject anything that lands elsewhere: a prefix check misses
  // `/\t/evil.com`, since the URL parser strips tabs/newlines and yields `//evil.com`.
  const nextUrl = new URL(searchParams.get("next") ?? "/onboarding", request.url);
  const next = nextUrl.origin === new URL(request.url).origin
    ? nextUrl.pathname + nextUrl.search + nextUrl.hash
    : "/onboarding";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  return NextResponse.redirect(
    new URL("/login?error=Confirmation link is invalid or has expired.", request.url)
  );
}
