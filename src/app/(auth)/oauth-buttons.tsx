import { GoogleLogo } from "@phosphor-icons/react/dist/ssr";
import { getLocale, getTranslations } from "next-intl/server";
import { oauthSignIn } from "./actions";
import { GoogleSignIn } from "./google-sign-in";

export async function OAuthButtons({ next, context = "signin" }: { next?: string; context?: "signin" | "signup" }) {
  const [t, locale] = await Promise.all([getTranslations("auth"), getLocale()]);

  // Redirect flow via Supabase: used when NEXT_PUBLIC_GOOGLE_CLIENT_ID is
  // unset or Google's script can't load.
  const redirectButton = (
    <form action={oauthSignIn}>
      {next && <input type="hidden" name="next" value={next} />}
      <button
        type="submit"
        name="provider"
        value="google"
        className="btn-press flex w-full items-center justify-center gap-2.5 rounded-xl border border-ink-700 bg-ink-900 py-3 text-sm font-medium text-paper transition-colors hover:border-ink-600 hover:text-flame"
      >
        <GoogleLogo className="size-5" weight="bold" />
        {t("continueWithGoogle")}
      </button>
    </form>
  );

  return (
    <div className="mt-7">
      <div className="flex items-center gap-3">
        <span aria-hidden className="h-px flex-1 bg-ink-800" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-paper-mute">
          {t("or")}
        </span>
        <span aria-hidden className="h-px flex-1 bg-ink-800" />
      </div>

      <div className="mt-5">
        <GoogleSignIn
          next={next}
          locale={locale}
          context={context}
          failedLabel={t("googleFailed")}
          fallback={redirectButton}
        />
      </div>
    </div>
  );
}
