import Link from "next/link";
import { Info, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { getTranslations } from "next-intl/server";
import { Reveal } from "@/components/motion/reveal";
import { login } from "../actions";
import { OAuthButtons } from "../oauth-buttons";

export const metadata = { title: "Log in" };

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

      {message && (
        <p data-reveal className="mt-5 flex items-start gap-2 rounded-lg border border-flame/25 bg-flame/[0.06] px-3.5 py-3 text-sm text-flame">
          <Info className="mt-0.5 size-4 shrink-0" weight="bold" />
          <span className="min-w-0 break-words">{message}</span>
        </p>
      )}
      {error && (
        <p data-reveal className="mt-5 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/[0.08] px-3.5 py-3 text-sm text-danger">
          <WarningCircle className="mt-0.5 size-4 shrink-0" weight="bold" />
          <span className="min-w-0 break-words">{error}</span>
        </p>
      )}

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
