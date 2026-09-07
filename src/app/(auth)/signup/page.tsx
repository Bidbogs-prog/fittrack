import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Reveal } from "@/components/motion/reveal";
import { StatusMessage } from "@/components/status-message";
import { signup } from "../actions";
import { OAuthButtons } from "../oauth-buttons";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("signup") };
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ error }, t] = await Promise.all([searchParams, getTranslations("auth")]);

  return (
    <Reveal className="w-full max-w-sm" onScroll={false} stagger={0.06} y={16}>
      <h1 data-reveal className="font-display text-3xl font-bold tracking-tight text-paper">{t("signupTitle")}</h1>
      <p data-reveal className="mt-2 text-sm text-paper-mute">{t("signupSubtitle")}</p>

      <StatusMessage error={error} />

      <form action={signup} className="mt-7 space-y-5">
        <div data-reveal className="space-y-2">
          <label htmlFor="full_name" className="field-label">{t("name")}</label>
          <input id="full_name" name="full_name" type="text" autoComplete="name" required className="field" placeholder={t("namePlaceholder")} />
        </div>
        <div data-reveal className="space-y-2">
          <label htmlFor="email" className="field-label">{t("email")}</label>
          <input id="email" name="email" type="email" autoComplete="email" required className="field" placeholder="you@example.com" />
        </div>
        <div data-reveal className="space-y-2">
          <label htmlFor="password" className="field-label">{t("password")}</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="field"
            placeholder={t("passwordPlaceholder")}
          />
          <p className="text-xs text-paper-mute">{t("passwordHint")}</p>
        </div>
        <button
          data-reveal
          type="submit"
          className="btn-press w-full rounded-xl bg-flame px-5 py-3 font-display text-sm font-bold uppercase tracking-wide text-flame-ink transition-colors hover:bg-flame-deep"
        >
          {t("createAccount")}
        </button>
      </form>

      <div data-reveal>
        <OAuthButtons />
      </div>

      <p data-reveal className="mt-6 text-sm text-paper-mute">
        {t("alreadyTracking")}{" "}
        <Link href="/login" className="font-medium text-paper underline-offset-4 hover:underline">
          {t("logIn")}
        </Link>
      </p>
    </Reveal>
  );
}
