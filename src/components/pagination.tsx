import { CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

const linkClass =
  "btn-press inline-flex items-center gap-1.5 rounded-lg border border-ink-700 px-3.5 py-2.5 text-xs font-semibold text-paper-dim transition-colors hover:border-ink-600 hover:text-paper";
const disabledClass =
  "inline-flex items-center gap-1.5 rounded-lg border border-ink-800 px-3.5 py-2.5 text-xs font-semibold text-paper-mute opacity-40";

/** Server-side pagination controls; hidden when everything fits one page. */
export async function Pagination({
  page,
  totalPages,
  total,
  makeHref,
}: {
  page: number;
  totalPages: number;
  total: number;
  makeHref: (page: number) => string;
}) {
  if (totalPages <= 1) return null;
  const t = await getTranslations("common");
  return (
    <nav className="flex flex-wrap items-center justify-between gap-3" aria-label={t("pagination")}>
      {page > 1 ? (
        <Link href={makeHref(page - 1)} className={linkClass}>
          <CaretLeft weight="bold" className="size-3.5" />
          {t("previous")}
        </Link>
      ) : (
        <span className={disabledClass}>
          <CaretLeft weight="bold" className="size-3.5" />
          {t("previous")}
        </span>
      )}
      <p className="order-last w-full text-center font-mono text-xs text-paper-mute tabular sm:order-none sm:w-auto">
        {t("pageSummary", { page, totalPages, count: total })}
      </p>
      {page < totalPages ? (
        <Link href={makeHref(page + 1)} className={linkClass}>
          {t("next")}
          <CaretRight weight="bold" className="size-3.5" />
        </Link>
      ) : (
        <span className={disabledClass}>
          {t("next")}
          <CaretRight weight="bold" className="size-3.5" />
        </span>
      )}
    </nav>
  );
}
