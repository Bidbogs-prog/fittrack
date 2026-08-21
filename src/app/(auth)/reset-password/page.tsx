import Link from "next/link";
import { WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { Reveal } from "@/components/motion/reveal";
import { createClient } from "@/lib/supabase/server";
import { resetPassword } from "../actions";

export const metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ error }, supabase] = await Promise.all([searchParams, createClient()]);
  const { data } = await supabase.auth.getClaims();

  // The recovery link from the email establishes a session via /auth/confirm.
  // No session = the link expired or was already used.
  if (!data?.claims) {
    return (
      <div className="w-full max-w-sm">
        <h1 className="font-display text-3xl font-bold tracking-tight text-paper">
          Link expired
        </h1>
        <p className="mt-2 text-sm text-paper-mute">
          This reset link is invalid or has expired. Request a fresh one and try again.
        </p>
        <Link
          href="/forgot-password"
          className="btn-press mt-6 inline-block rounded-xl bg-flame px-5 py-3 font-display text-sm font-bold uppercase tracking-wide text-flame-ink hover:bg-flame-deep"
        >
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <Reveal className="w-full max-w-sm" onScroll={false} stagger={0.06} y={16}>
      <h1 data-reveal className="font-display text-3xl font-bold tracking-tight text-paper">
        Choose a new password
      </h1>
      <p data-reveal className="mt-2 text-sm text-paper-mute">
        At least 8 characters. You&rsquo;ll be signed in right after.
      </p>

      {error && (
        <p
          data-reveal
          className="mt-5 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/[0.08] px-3.5 py-3 text-sm text-danger"
        >
          <WarningCircle className="mt-0.5 size-4 shrink-0" weight="bold" />
          <span className="min-w-0 break-words">{error}</span>
        </p>
      )}

      <form action={resetPassword} className="mt-7 space-y-5">
        <div data-reveal className="space-y-2">
          <label htmlFor="password" className="field-label">New password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            className="field"
            placeholder="••••••••"
          />
        </div>
        <button
          data-reveal
          type="submit"
          className="btn-press w-full rounded-xl bg-flame px-5 py-3 font-display text-sm font-bold uppercase tracking-wide text-flame-ink transition-colors hover:bg-flame-deep"
        >
          Set password
        </button>
      </form>
    </Reveal>
  );
}
