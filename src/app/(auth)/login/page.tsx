import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Reveal } from "@/components/motion/reveal";
import { StatusMessage } from "@/components/status-message";
import { login } from "../actions";
import { OAuthButtons } from "../oauth-buttons";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("login") };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; next?: string }>;
}) {
  const [{ error, message, next }, t] = await Promise.all([searchParams, getTranslations("auth")]);

  return (
    <Reveal className="w-full max-w-sm" onScroll={false} stagger={0.06} y={16}>
      <h1 data-reveal className="font-display text-3xl font-bold tracking-tight text-paper">{t("welcomeBack")}</h1>
      <p data-reveal className="mt-2 text-sm text-paper-mute">{t("loginSubtitle")}</p>

      <StatusMessage error={error} message={message} />

      <form action={login} className="mt-7 space-y-5">
        {next && <input type="hidden" name="next" value={next} />}
        <div data-reveal className="space-y-2">
          <label htmlFor="email" className="field-label">{t("email")}</label>
          <input id="email" name="email" type="email" autoComplete="email" required className="field" placeholder="you@example.com" />
        </div>
        <div data-reveal className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="field-label">{t("password")}</label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-paper-mute underline-offset-4 hover:text-paper hover:underline"
            >
              {t("forgotPassword")}
            </Link>
          </div>
          <input id="password" name="password" type="password" autoComplete="current-password" required className="field" placeholder="••••••••" />
        </div>
        <button
          data-reveal
          type="submit"
          className="btn-press w-full rounded-xl bg-flame px-5 py-3 font-display text-sm font-bold uppercase tracking-wide text-flame-ink transition-colors hover:bg-flame-deep"
        >
          {t("logIn")}
        </button>
      </form>

      <div data-reveal>
        <OAuthButtons next={next} />
      </div>

      <p data-reveal className="mt-6 text-sm text-paper-mute">
        {t("newHere")}{" "}
        <Link href="/signup" className="font-medium text-paper underline-offset-4 hover:underline">
          {t("createAccount")}
        </Link>
      </p>
    </Reveal>
  );
}
