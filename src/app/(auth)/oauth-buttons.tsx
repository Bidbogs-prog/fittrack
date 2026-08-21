import { GoogleLogo } from "@phosphor-icons/react/dist/ssr";
import { oauthSignIn } from "./actions";

export function OAuthButtons({ next }: { next?: string }) {
  return (
    <div className="mt-7">
      <div className="flex items-center gap-3">
        <span aria-hidden className="h-px flex-1 bg-ink-800" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-paper-mute">
          or
        </span>
        <span aria-hidden className="h-px flex-1 bg-ink-800" />
      </div>

      <form action={oauthSignIn} className="mt-5">
        {next && <input type="hidden" name="next" value={next} />}
        <button
          type="submit"
          name="provider"
          value="google"
          className="btn-press flex w-full items-center justify-center gap-2.5 rounded-xl border border-ink-700 bg-ink-900 py-3 text-sm font-medium text-paper transition-colors hover:border-ink-600 hover:text-flame"
        >
          <GoogleLogo className="size-5" weight="bold" />
          Continue with Google
        </button>
      </form>
    </div>
  );
}