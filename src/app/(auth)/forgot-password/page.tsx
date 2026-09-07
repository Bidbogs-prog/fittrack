import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Reveal } from "@/components/motion/reveal";
import { StatusMessage } from "@/components/status-message";
import { forgotPassword } from "../actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("forgotPassword") };
}

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ error }, t] = await Promise.all([searchParams, getTranslations("auth")]);

  return (
    <Reveal className="w-full max-w-sm" onScroll={false} stagger={0.06} y={16}>
      <h1 data-reveal className="font-display text-3xl font-bold tracking-tight text-paper">
        {t("forgotTitle")}
      </h1>
      <p data-reveal className="mt-2 text-sm text-paper-mute">
        {t("forgotSubtitle")}
      </p>

      <StatusMessage error={error} />

      <form action={forgotPassword} className="mt-7 space-y-5">
        <div data-reveal className="space-y-2">
          <label htmlFor="email" className="field-label">{t("email")}</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="field"
            placeholder="you@example.com"
          />
        </div>
        <button
          data-reveal
          type="submit"
          className="btn-press w-full rounded-xl bg-flame px-5 py-3 font-display text-sm font-bold uppercase tracking-wide text-flame-ink transition-colors hover:bg-flame-deep"
        >
          {t("sendResetLink")}
        </button>
      </form>

      <p data-reveal className="mt-6 text-sm text-paper-mute">
        {t("rememberedIt")}{" "}
        <Link href="/login" className="font-medium text-paper underline-offset-4 hover:underline">
          {t("backToLogin")}
        </Link>
      </p>
    </Reveal>
  );
}
