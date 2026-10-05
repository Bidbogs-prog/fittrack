import { getTranslations } from "next-intl/server";

/**
 * Instant feedback for in-app navigation. Every (app) page is dynamic
 * (per-user Supabase reads), so without this boundary a tab tap shows
 * nothing until the whole server render finishes. It also lets <Link>
 * prefetch the shell up to here, so the skeleton paints immediately.
 */
export default async function AppLoading() {
  const t = await getTranslations("shell");
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={t("loading")}
      className="flex flex-col gap-4 px-[18px] pt-4 pb-8 lg:px-9 lg:pt-8"
    >
      <span className="h-7 w-40 animate-pulse rounded-lg bg-ink-800 lg:h-9 lg:w-56" />
      <span className="h-4 w-64 max-w-full animate-pulse rounded bg-ink-800/70" />
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="h-28 animate-pulse rounded-2xl border border-ink-800 bg-ink-900"
            style={{ animationDelay: `${i * 120}ms` }}
          />
        ))}
      </div>
      <span className="h-48 animate-pulse rounded-2xl border border-ink-800 bg-ink-900" />
    </div>
  );
}
