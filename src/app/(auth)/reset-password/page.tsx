import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Reveal } from "@/components/motion/reveal";
import { StatusMessage } from "@/components/status-message";
import { createClient } from "@/lib/supabase/server";
import { resetPassword } from "../actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("resetPassword") };
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ error }, supabase, t] = await Promise.all([
    searchParams,
    createClient(),
    getTranslations("auth"),
  ]);
  const { data } = await supabase.auth.getClaims();

  // The recovery link from the email establishes a session via /auth/confirm.
  // No session = the link expired or was already used.
  if (!data?.claims) {
    return (
      <div className="w-full max-w-sm">
        <h1 className="font-display text-3xl font-bold tracking-tight text-paper">
          {t("linkExpired")}
        </h1>
        <p className="mt-2 text-sm text-paper-mute">{t("linkExpiredHint")}</p>
        <Link
          href="/forgot-password"
          className="btn-press mt-6 inline-block rounded-xl bg-flame px-5 py-3 font-display text-sm font-bold uppercase tracking-wide text-flame-ink hover:bg-flame-deep"
        >
          {t("requestNewLink")}
        </Link>
      </div>
    );
  }

  return (
    <Reveal className="w-full max-w-sm" onScroll={false} stagger={0.06} y={16}>
      <h1 data-reveal className="font-display text-3xl font-bold tracking-tight text-paper">
        {t("chooseNewPassword")}
      </h1>
      <p data-reveal className="mt-2 text-sm text-paper-mute">{t("chooseNewPasswordHint")}</p>

      <StatusMessage error={error} />

      <form action={resetPassword} className="mt-7 space-y-5">
        <div data-reveal className="space-y-2">
          <label htmlFor="password" className="field-label">{t("newPassword")}</label>
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
          {t("setPassword")}
        </button>
      </form>
    </Reveal>
  );
}
