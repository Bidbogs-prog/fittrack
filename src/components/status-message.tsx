import { Info, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { getTranslations } from "next-intl/server";
import { toStatusKey } from "@/i18n/status";

/**
 * Renders the `?error=` / `?message=` status keys a server action redirects
 * with (see `src/i18n/status.ts`). Unknown values fall back to the generic
 * message rather than being echoed — `searchParams` is attacker-controlled.
 */
export async function StatusMessage({
  error,
  message,
  className = "mt-5",
}: {
  error?: string;
  message?: string;
  className?: string;
}) {
  const errorKey = toStatusKey(error);
  // An unrecognised error still means something failed; an unrecognised
  // success message is worth nothing, so drop it.
  const failed = error ? (errorKey ?? "generic") : undefined;
  const succeeded = toStatusKey(message);
  if (!failed && !succeeded) return null;

  const t = await getTranslations("status");
  const tone = failed
    ? "border-danger/30 bg-danger/[0.08] text-danger"
    : "border-flame/25 bg-flame/[0.06] text-flame";
  const Icon = failed ? WarningCircle : Info;

  return (
    <p
      data-reveal
      role={failed ? "alert" : "status"}
      className={`flex items-start gap-2 rounded-lg border px-3.5 py-3 text-sm ${tone} ${className}`}
    >
      <Icon className="mt-0.5 size-4 shrink-0" weight="bold" />
      <span className="min-w-0 break-words">{t(failed ?? succeeded!)}</span>
    </p>
  );
}
