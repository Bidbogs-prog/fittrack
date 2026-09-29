import { Plus } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { FoodImage } from "@/components/food-image";
import { FoodSearch } from "@/components/food-search";
import { Pagination } from "@/components/pagination";
import { requireUser } from "@/lib/auth";
import { FOODS_PAGE_SIZE, foodSourceLabel as sourceLabel, parseCategory, sanitizeSearch, searchFoods } from "@/lib/foods";
import { FOOD_CATEGORIES, type Food } from "@/lib/types";
import { ScanButton } from "./scan-button";

export const metadata = { title: "Food library" };

function href(params: { c?: string | null; q?: string; page?: number; mine?: boolean }): string {
  const sp = new URLSearchParams();
  if (params.mine) sp.set("mine", "1");
  if (params.c) sp.set("c", params.c);
  if (params.q) sp.set("q", params.q);
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  const qs = sp.toString();
  return qs ? `/foods?${qs}` : "/foods";
}

/** Calorie share by macro: the food's "DNA" bar. */
function MacroDna({ food }: { food: Food }) {
  const p = food.protein_g * 4;
  const c = food.carbs_g * 4;
  const f = food.fat_g * 9;
  const sum = p + c + f;
  return (
    <span aria-hidden className="flex h-1 gap-0.5 overflow-hidden rounded-full bg-ink-800">
      {sum > 0 && (
        <>
          <span className="bg-protein" style={{ flex: p }} />
          <span className="bg-carbs" style={{ flex: c }} />
          <span className="bg-fat" style={{ flex: f }} />
        </>
      )}
    </span>
  );
}

export default async function FoodsPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; q?: string; page?: string; mine?: string }>;
}) {
  const [{ supabase }, params, t, format] = await Promise.all([
    requireUser(),
    searchParams,
    getTranslations("foods"),
    getFormatter(),
  ]);

  const category = parseCategory(params.c);
  const q = sanitizeSearch(params.q ?? "");
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const mine = params.mine === "1";

  const { foods, total } = await searchFoods(supabase, { q, category, page, mine });
  const totalPages = Math.max(1, Math.ceil(total / FOODS_PAGE_SIZE));

  const chip = (on: boolean) =>
    `inline-flex min-h-9 shrink-0 items-center rounded-full px-3 text-xs capitalize ${
      on ? "bg-paper font-medium text-ink-950" : "border border-ink-700 text-paper-dim hover:text-paper"
    }`;
  const railItem = (on: boolean) =>
    `flex min-h-9 items-center rounded-lg px-2.5 text-sm ${
      on ? "bg-flame/10 font-medium text-flame" : "text-paper-dim hover:text-paper"
    }`;

  return (
    <div className="grid gap-3.5 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-8">
      {/* filter rail (desktop) / title (mobile) */}
      <aside className="flex flex-col gap-1.5">
        <div className="flex items-end justify-between lg:mb-[18px]">
          <h1 className="font-display text-[26px] font-bold tracking-[-0.03em] text-paper lg:text-[40px] lg:leading-[1.05] lg:tracking-[-0.035em]">
            {t("title")}
          </h1>
          <Link
            href="/foods/new"
            className="inline-flex min-h-9 items-center rounded-full border border-ink-700 px-3 text-xs text-paper-dim hover:text-paper lg:hidden"
          >
            + {t("myFood")}
          </Link>
        </div>
        <nav aria-label={t("collections")} className="flex flex-col gap-0.5 max-lg:hidden">
          <p className="mb-1 text-[10px] font-semibold tracking-[0.14em] text-paper-mute uppercase">{t("collections")}</p>
          <Link href={href({ c: category, q })} aria-current={!mine ? "page" : undefined} className={railItem(!mine)}>
            {t("library")}
          </Link>
          <Link href={href({ c: category, q, mine: true })} aria-current={mine ? "page" : undefined} className={railItem(mine)}>
            {t("mine")}
          </Link>
          <Link href="/recipes" className={railItem(false)}>
            {t("recipes")}
          </Link>
        </nav>
        <nav aria-label={t("category")} className="mt-4 flex flex-col gap-0.5 max-lg:hidden">
          <p className="mb-1 text-[10px] font-semibold tracking-[0.14em] text-paper-mute uppercase">{t("category")}</p>
          {[null, ...FOOD_CATEGORIES].map((cat) => {
            const on = category === cat;
            return (
              <Link
                key={cat ?? "all"}
                href={href({ c: cat, q, mine })}
                aria-current={on ? "page" : undefined}
                className={`flex min-h-8 items-center gap-2 px-2.5 text-sm ${on ? "text-paper" : "text-paper-mute hover:text-paper"}`}
              >
                <span
                  aria-hidden
                  className={`size-2 rounded-full ${on ? "bg-flame" : "border border-ink-600"}`}
                />
                {cat ? t(`cat.${cat}`) : t("all")}
              </Link>
            );
          })}
        </nav>
        <p className="mt-4 text-[10px] font-semibold tracking-[0.14em] text-paper-mute uppercase max-lg:hidden">
          {t("source")}
        </p>
        <p className="px-2.5 text-[13px] text-paper-dim max-lg:hidden">USDA · Open Food Facts · So3ra</p>
      </aside>

      <div className="flex min-w-0 flex-col gap-3 lg:gap-4 lg:pt-1">
        <div className="flex gap-2.5">
          <FoodSearch
            initialQuery={q}
            category={category}
            mine={mine}
            placeholder={t("searchPlaceholder", { count: format.number(total) })}
            trailing={
              <>
                <span className="rounded-md border border-ink-700 px-1.5 py-0.5 font-mono text-[11px] text-paper-mute max-lg:hidden">
                  ⌘K
                </span>
                <span className="lg:hidden">
                  <ScanButton />
                </span>
              </>
            }
          />
          <span className="max-lg:hidden">
            <ScanButton variant="button" />
          </span>
          <Link
            href="/foods/new"
            className="btn-press inline-flex min-h-12 items-center gap-1.5 rounded-[14px] bg-paper px-4 text-sm font-semibold text-ink-950 max-lg:hidden"
          >
            <Plus weight="bold" className="size-4" />
            {t("myFood")}
          </Link>
        </div>

        {/* mobile chips: collections + categories */}
        <nav aria-label={t("category")} className="no-scrollbar -mx-[18px] flex gap-1.5 overflow-x-auto px-[18px] lg:hidden">
          <Link href={href({ c: category, q, mine: !mine })} className={chip(mine)}>
            {t("mine")}
          </Link>
          <Link href="/recipes" className={chip(false)}>
            {t("recipes")}
          </Link>
          <span aria-hidden className="w-px shrink-0 bg-ink-800" />
          {FOOD_CATEGORIES.map((cat) => (
            <Link key={cat} href={href({ c: category === cat ? null : cat, q, mine })} className={chip(category === cat)}>
              {t(`cat.${cat}`)}
            </Link>
          ))}
        </nav>

        {foods.length === 0 ? (
          <p className="rounded-[20px] border border-dashed border-ink-700 px-6 py-14 text-center text-sm text-paper-mute">
            {q ? t("noMatch", { q }) : mine ? t("noneMine") : t("noneCategory")}
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:gap-3.5 xl:grid-cols-4">
            {foods.map((food) => (
              <li key={food.id}>
                <Link
                  href={`/foods/${food.id}`}
                  className="card-lift flex h-full flex-col gap-1.5 rounded-[18px] border border-ink-800 bg-ink-900 p-2 hover:border-ink-600 lg:gap-2 lg:rounded-[20px] lg:p-2.5"
                >
                  <FoodImage src={food.image_url} alt="" className="h-[84px] w-full rounded-xl lg:h-[120px] lg:rounded-[14px]" />
                  <span className="line-clamp-2 px-0.5 text-[13px] font-medium text-paper lg:text-sm" dir="auto">
                    {food.name}
                  </span>
                  <span className="mt-auto flex justify-between gap-2 px-0.5 font-mono text-[11px] text-paper-mute tabular">
                    <span>{Math.round(food.kcal)} kcal/100 g</span>
                    <span className="max-lg:hidden">{sourceLabel(food)}</span>
                  </span>
                  <MacroDna food={food} />
                </Link>
              </li>
            ))}
          </ul>
        )}

        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          makeHref={(p) => href({ c: category, q, page: p, mine })}
        />

        <p className="border-t border-ink-800 pt-4 text-xs text-paper-mute">
          {t.rich("attribution", {
            off: (c) => (
              <a
                href="https://world.openfoodfacts.org"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 hover:text-paper"
              >
                {c}
              </a>
            ),
            odbl: (c) => (
              <a
                href="https://opendatacommons.org/licenses/odbl/1-0/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4 hover:text-paper"
              >
                {c}
              </a>
            ),
          })}
        </p>
      </div>
    </div>
  );
}
