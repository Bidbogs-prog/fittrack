"use client";

import { useTranslations } from "next-intl";
import { toStatusKey } from "@/i18n/status";

/**
 * Renders the status key a server action returns as `{ error }` (see
 * `src/i18n/status.ts`). The client counterpart to `<StatusMessage>`, which
 * handles the same keys arriving through the URL.
 *
 * Actions return keys rather than prose because they can't know the reader's
 * language, and because Supabase/Postgres error text is English from outside
 * the app — those come back as `generic`.
 */
export function ActionError({
  error,
  className = "text-sm text-danger",
}: {
  error?: string | null;
  className?: string;
}) {
  const t = useTranslations("status");
  if (!error) return null;
  return (
    <p role="alert" className={className}>
      {t(toStatusKey(error) ?? "generic")}
    </p>
  );
}
