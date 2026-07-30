import { CaretLeft, CaretRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

const linkClass =
  "btn-press inline-flex items-center gap-1.5 rounded-lg border border-ink-700 px-3.5 py-2 text-xs font-semibold text-paper-dim transition-colors hover:border-ink-600 hover:text-paper";
const disabledClass =
  "inline-flex items-center gap-1.5 rounded-lg border border-ink-800 px-3.5 py-2 text-xs font-semibold text-paper-mute opacity-40";

/** Server-side pagination controls; hidden when everything fits one page. */
export function Pagination({
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
  return (
    <nav className="flex items-center justify-between" aria-label="Pagination">
      {page > 1 ? (
        <Link href={makeHref(page - 1)} className={linkClass}>
          <CaretLeft weight="bold" className="size-3.5" />
          Previous
        </Link>
      ) : (
        <span className={disabledClass}>
          <CaretLeft weight="bold" className="size-3.5" />
          Previous
        </span>
      )}
      <p className="font-mono text-xs text-paper-mute tabular">
        Page {page} of {totalPages} · {total.toLocaleString("en-US")} foods
      </p>
      {page < totalPages ? (
        <Link href={makeHref(page + 1)} className={linkClass}>
          Next
          <CaretRight weight="bold" className="size-3.5" />
        </Link>
      ) : (
        <span className={disabledClass}>
          Next
          <CaretRight weight="bold" className="size-3.5" />
        </span>
      )}
    </nav>
  );
}
