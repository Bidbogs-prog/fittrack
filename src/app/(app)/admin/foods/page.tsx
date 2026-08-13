import { CheckCircle, PencilSimple, Trash, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { FoodImage } from "@/components/food-image";
import { FoodSearch } from "@/components/food-search";
import { Pagination } from "@/components/pagination";
import { requireAdmin } from "@/lib/auth";
import { sanitizeSearch, searchFoods } from "@/lib/foods";
import { deleteFood } from "../actions";
import { FoodForm } from "./food-form";

export const metadata = { title: "Admin · Foods" };

const PAGE_SIZE = 50;

export default async function AdminFoodsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string; q?: string; page?: string }>;
}) {
  const [{ supabase }, params] = await Promise.all([requireAdmin(), searchParams]);
  const { error, saved } = params;

  const q = sanitizeSearch(params.q ?? "");
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const { foods, total } = await searchFoods(supabase, {
    q,
    page,
    pageSize: PAGE_SIZE,
    orderBy: q ? "name" : "newest",
  });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (p: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `/admin/foods?${qs}` : "/admin/foods";
  };

  return (
    <div className="space-y-8">
      {saved && (
        <p className="flex items-start gap-2 rounded-lg border border-lime/25 bg-lime/[0.06] px-3.5 py-3 text-sm text-lime">
          <CheckCircle className="mt-0.5 size-4 shrink-0" weight="bold" />
          “{saved}” saved to the library.
        </p>
      )}
      {error && (
        <p className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/[0.08] px-3.5 py-3 text-sm text-danger">
          <WarningCircle className="mt-0.5 size-4 shrink-0" weight="bold" />
          {error}
        </p>
      )}

      <section className="rounded-2xl border border-ink-800 bg-ink-900/60 p-6">
        <h2 className="font-display text-lg font-semibold tracking-tight text-paper">
          Add a food
        </h2>
        <p className="mb-5 mt-1 text-xs text-paper-mute">
          Facts are per 100 g — portion math is derived from these numbers everywhere in the app.
        </p>
        <FoodForm />
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold tracking-tight text-paper">
          Library{" "}
          <span className="font-mono text-sm text-paper-mute tabular">
            ({total.toLocaleString("en-US")})
          </span>
        </h2>
        <FoodSearch initialQuery={q} category={null} />
        {foods.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-ink-700 px-6 py-14 text-center text-sm text-paper-mute">
            {q ? <>Nothing matches &ldquo;{q}&rdquo;.</> : "No foods yet — add your first one above."}
          </p>
        ) : (
          <div className="overflow-x-auto overscroll-x-contain rounded-2xl border border-ink-800">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-ink-800 text-left text-[11px] uppercase tracking-[0.12em] text-paper-mute">
                  <th className="px-4 py-3 font-semibold">Food</th>
                  <th className="px-3 py-3 text-right font-semibold">kcal</th>
                  <th className="px-3 py-3 text-right font-semibold">Protein</th>
                  <th className="px-3 py-3 text-right font-semibold">Carbs</th>
                  <th className="px-3 py-3 text-right font-semibold">Fat</th>
                  <th className="px-3 py-3 text-right font-semibold">Fibre</th>
                  <th className="sticky right-0 bg-ink-950 px-4 py-3 text-right font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-800/70">
                {foods.map((food) => (
                  <tr key={food.id} className="bg-ink-900/40 transition-colors hover:bg-ink-850">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <FoodImage src={food.image_url} alt="" className="size-9 rounded-md" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-paper">{food.name}</p>
                          <p className="truncate text-[11px] capitalize text-paper-mute">
                            {food.brand ? `${food.brand} · ` : ""}
                            {food.category.replace("-", " & ")}
                            {food.source !== "manual" && (
                              <span className="uppercase"> · {food.source}</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </td>
                    {([food.kcal, food.protein_g, food.carbs_g, food.fat_g, food.fibre_g] as const).map(
                      (v, i) => (
                        <td key={i} className="px-3 py-2.5 text-right font-mono text-paper-dim tabular">
                          {v}
                        </td>
                      )
                    )}
                    {/* Sticky so edit/delete stay reachable while the wide
                        table scrolls horizontally on narrow screens. */}
                    <td className="sticky right-0 bg-ink-900 px-4 py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/admin/foods/${food.id}`}
                          aria-label={`Edit ${food.name}`}
                          className="btn-press rounded-md p-2.5 text-paper-mute hover:bg-ink-700 hover:text-paper"
                        >
                          <PencilSimple className="size-4" />
                        </Link>
                        <form action={deleteFood}>
                          <input type="hidden" name="id" value={food.id} />
                          <button
                            type="submit"
                            aria-label={`Delete ${food.name}`}
                            className="btn-press rounded-md p-2.5 text-paper-mute hover:bg-danger/10 hover:text-danger pointer-coarse:text-danger/80"
                          >
                            <Trash className="size-4" />
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} totalPages={totalPages} total={total} makeHref={href} />
      </section>
    </div>
  );
}
