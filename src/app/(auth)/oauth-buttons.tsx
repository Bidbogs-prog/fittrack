import { FacebookLogo, GithubLogo, GoogleLogo } from "@phosphor-icons/react/dist/ssr";
import { oauthSignIn } from "./actions";

const PROVIDERS = [
  { id: "google", label: "Google", Icon: GoogleLogo },
  { id: "github", label: "GitHub", Icon: GithubLogo },
  { id: "facebook", label: "Facebook", Icon: FacebookLogo },
] as const;

export function OAuthButtons({ next }: { next?: string }) {
  return (
    <div className="mt-7">
      <div className="flex items-center gap-3">
        <span aria-hidden className="h-px flex-1 bg-ink-800" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-paper-mute">
          or continue with
        </span>
        <span aria-hidden className="h-px flex-1 bg-ink-800" />
      </div>

      <form action={oauthSignIn} className="mt-5 grid grid-cols-3 gap-3">
        {next && <input type="hidden" name="next" value={next} />}
        {PROVIDERS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="submit"
            name="provider"
            value={id}
            aria-label={`Continue with ${label}`}
            title={`Continue with ${label}`}
            className="btn-press flex flex-col items-center justify-center gap-1 rounded-xl border border-ink-700 bg-ink-900 py-2.5 text-paper transition-colors hover:border-ink-600 hover:text-lime"
          >
            <Icon className="size-5" weight="bold" />
            <span className="text-[11px] font-medium text-paper-mute">{label}</span>
          </button>
        ))}
      </form>
    </div>
  );
}