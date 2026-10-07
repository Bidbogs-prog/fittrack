import { getTranslations } from "next-intl/server";
import { RouteSkeleton } from "./route-skeleton";

/**
 * Instant feedback for in-app navigation. Every (app) page is dynamic
 * (per-user Supabase reads), so without this boundary a tab tap shows
 * nothing until the whole server render finishes. It also lets <Link>
 * prefetch the shell up to here, so the skeleton paints immediately.
 * The skeleton itself is route-shaped (route-skeleton.tsx).
 */
export default async function AppLoading() {
  const t = await getTranslations("shell");
  return <RouteSkeleton label={t("loading")} />;
}
