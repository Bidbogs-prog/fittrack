import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/logo";
import { requireUser } from "@/lib/auth";
import { ensureBetaAccess, INVITE_COOKIE } from "@/lib/beta";
import { signout } from "../(auth)/actions";
import { redeemInvite } from "./actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("invite");
  return { title: t("title") };
}

const ERRORS = ["invalid", "expired", "full", "generic"] as const;

/** The beta gate: signed in, but no invite redeemed and not admitted yet. */
export default async function InvitePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [{ supabase, userId, claims }, { error }, t, jar] = await Promise.all([
    requireUser(),
    searchParams,
    getTranslations("invite"),
    cookies(),
  ]);
  if (await ensureBetaAccess(supabase, userId)) redirect("/onboarding");
  const prefill = jar.get(INVITE_COOKIE)?.value ?? "";
  const err = ERRORS.find((e) => e === error);

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-sm flex-col px-6 pt-8 pb-12">
      <Logo href="/" size="sm" />
      <div className="mt-16 flex flex-col gap-3">
        <p className="text-xs font-semibold tracking-[0.14em] text-flame uppercase">{t("eyebrow")}</p>
        <h1 className="font-display text-3xl font-bold tracking-[-0.03em] text-paper">{t("title")}</h1>
        <p className="text-sm leading-relaxed text-paper-dim">{t("body")}</p>
      </div>

      {err && (
        <p role="alert" className="mt-6 rounded-xl border border-danger/30 bg-danger/[0.08] px-3.5 py-3 text-sm text-danger">
          {t(`errors.${err}`)}
        </p>
      )}

      <form action={redeemInvite} className="mt-7 space-y-4">
        <div className="space-y-2">
          <label htmlFor="code" className="field-label">
            {t("codeLabel")}
          </label>
          <input
            id="code"
            name="code"
            required
            defaultValue={prefill}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="field font-mono tracking-[0.12em] uppercase"
            placeholder="SO3RA-XXXX"
          />
        </div>
        <button type="submit" className="btn-press btn-flame w-full rounded-xl px-5 py-3 text-sm font-semibold">
          {t("submit")}
        </button>
      </form>

      <div className="mt-8 rounded-2xl border border-ink-800 bg-ink-900 p-4 text-sm text-paper-dim">
        <p>{t("noCode", { email: String(claims.email ?? "") })}</p>
        <Link href="/#waitlist" className="mt-2 inline-flex min-h-9 items-center font-medium text-flame hover:text-flame-glow">
          {t("joinWaitlist")} <span aria-hidden className="ms-1 rtl:-scale-x-100">→</span>
        </Link>
      </div>

      <form action={signout} className="mt-auto pt-10">
        <button type="submit" className="text-xs text-paper-mute hover:text-paper">
          {t("signOut")}
        </button>
      </form>
    </div>
  );
}
