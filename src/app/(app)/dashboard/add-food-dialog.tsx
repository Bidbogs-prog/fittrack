"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  Barcode,
  BowlFood,
  CaretRight,
  Lightning,
  MagnifyingGlass,
  Plus,
  Sparkle,
  Star,
  X,
} from "@phosphor-icons/react";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { AiLogView } from "./ai-log-view";
import { FoodImage } from "@/components/food-image";
import type { RecipeSuggestion } from "@/lib/diary";
import {
  MICRONUTRIENTS,
  formatAmount,
  macrosForPortion,
  microsForPortion,
  percentDv,
} from "@/lib/nutrition";
import { MICRO_KEYS, type Food, type MealType } from "@/lib/types";
import { addDiaryEntry, addQuickEntry, addRecipeEntry, toggleFavoriteFood } from "./actions";

interface Suggestions {
  favorites: Food[];
  recents: Food[];
  frequents: Food[];
  favoriteIds: string[];
  recipes: RecipeSuggestion[];
}

type View =
  | { kind: "browse" }
  | { kind: "food"; food: Food }
  | { kind: "recipe"; recipe: RecipeSuggestion }
  | { kind: "quick" }
  | { kind: "ai" }
  | { kind: "scan" }
  | { kind: "scanMiss"; code: string };

export function AddFoodDialog({
  meal,
  entryDate,
}: {
  meal: MealType;
  entryDate: string;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>({ kind: "browse" });
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Food[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [grams, setGrams] = useState("100");
  const [servings, setServings] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);

  // Lock the page scroll behind the dialog (iOS scrolls the body otherwise)
  // and close on Escape for keyboard users.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Zero-query shelves: favorites / recents / frequents / recipes.
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/foods/suggestions", { signal: controller.signal });
        if (!res.ok) return;
        const json = (await res.json()) as Suggestions;
        setSuggestions(json);
        setFavoriteIds(new Set(json.favoriteIds));
      } catch {
        // Shelves are an enhancement — search still works without them.
      }
    })();
    return () => controller.abort();
  }, [open]);

  // The library is 5k+ foods, so search runs server-side (route handler).
  useEffect(() => {
    if (!open || view.kind !== "browse" || !query.trim()) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/foods/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`search failed (${res.status})`);
        const json = (await res.json()) as { foods: Food[] };
        setResults(json.foods);
        setSearchFailed(false);
        setSearching(false);
      } catch {
        if (!controller.signal.aborted) {
          setResults([]);
          setSearchFailed(true);
          setSearching(false);
        }
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [open, view.kind, query]);

  function reset() {
    setOpen(false);
    setView({ kind: "browse" });
    setQuery("");
    setResults([]);
    setGrams("100");
    setServings("1");
    setError(null);
  }

  function backToBrowse() {
    setView({ kind: "browse" });
    setGrams("100");
    setServings("1");
    setError(null);
  }

  function run(action: () => Promise<{ error: string | null } | undefined>) {
    startTransition(async () => {
      const res = await action();
      if (res?.error) setError(res.error);
      else reset();
    });
  }

  function submitFood(food: Food) {
    const fd = new FormData();
    fd.set("food_id", food.id);
    fd.set("meal", meal);
    fd.set("entry_date", entryDate);
    fd.set("grams", grams);
    run(() => addDiaryEntry(fd));
  }

  function submitRecipe(recipe: RecipeSuggestion) {
    const fd = new FormData();
    fd.set("recipe_id", recipe.id);
    fd.set("meal", meal);
    fd.set("entry_date", entryDate);
    fd.set("servings", servings);
    run(() => addRecipeEntry(fd));
  }

  function submitQuick(fd: FormData) {
    fd.set("meal", meal);
    fd.set("entry_date", entryDate);
    run(() => addQuickEntry(fd));
  }

  async function handleBarcode(code: string) {
    try {
      const res = await fetch(`/api/foods/barcode?code=${encodeURIComponent(code)}`);
      const json = (await res.json()) as { food: Food | null };
      if (json.food) {
        setError(null);
        setView({ kind: "food", food: json.food });
      } else {
        setView({ kind: "scanMiss", code });
      }
    } catch {
      setView({ kind: "scanMiss", code });
    }
  }

  function toggleFavorite(food: Food) {
    // Optimistic: the star flips instantly, the server settles it.
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(food.id)) next.delete(food.id);
      else next.add(food.id);
      return next;
    });
    const fd = new FormData();
    fd.set("food_id", food.id);
    void toggleFavoriteFood(fd);
  }

  function selectFood(food: Food) {
    setView({ kind: "food", food });
    setError(null);
  }

  const hasShelves =
    suggestions != null &&
    (suggestions.favorites.length > 0 ||
      suggestions.recents.length > 0 ||
      suggestions.frequents.length > 0 ||
      suggestions.recipes.length > 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-press inline-flex items-center gap-1.5 rounded-lg border border-ink-700 px-3 py-1.5 text-xs font-semibold text-paper-dim transition-colors hover:border-lime/50 hover:text-lime pointer-coarse:py-2.5"
      >
        <Plus weight="bold" className="size-3.5" />
        Add food
      </button>

      {open && (
        <div
          // Centered (not bottom-anchored): iOS keeps the keyboard over a
          // bottom sheet without resizing the layout viewport.
          className="overlay-fade fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 p-4 backdrop-blur-sm"
          // mousedown + self-target: a text-selection drag that ends on the
          // backdrop must not nuke the dialog state.
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) reset();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Add food to ${meal}`}
            className="dialog-pop max-h-[85dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-2xl border border-ink-700 bg-ink-900 p-5 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.05)] lg:max-w-lg"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-semibold capitalize text-paper">
                Add to {meal}
              </h3>
              <button
                type="button"
                onClick={reset}
                aria-label="Close"
                className="btn-press rounded-md p-2.5 text-paper-mute hover:bg-ink-800 hover:text-paper"
              >
                <X className="size-4" weight="bold" />
              </button>
            </div>

            {view.kind === "browse" && (
              <>
                <div className="relative mt-4">
                  <MagnifyingGlass className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-paper-mute" />
                  <input
                    ref={searchRef}
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search the food library…"
                    className="field pl-10"
                  />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setView({ kind: "ai" });
                      setError(null);
                    }}
                    className="btn-press inline-flex items-center gap-1.5 rounded-lg border border-lime/40 px-3 py-2 text-xs font-semibold text-lime transition-colors hover:border-lime hover:bg-lime/10"
                  >
                    <Sparkle weight="bold" className="size-3.5" />
                    Describe meal
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setView({ kind: "scan" });
                      setError(null);
                    }}
                    className="btn-press inline-flex items-center gap-1.5 rounded-lg border border-ink-700 px-3 py-2 text-xs font-semibold text-paper-dim transition-colors hover:border-lime/50 hover:text-lime"
                  >
                    <Barcode weight="bold" className="size-3.5" />
                    Scan barcode
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setView({ kind: "quick" });
                      setError(null);
                    }}
                    className="btn-press inline-flex items-center gap-1.5 rounded-lg border border-ink-700 px-3 py-2 text-xs font-semibold text-paper-dim transition-colors hover:border-lime/50 hover:text-lime"
                  >
                    <Lightning weight="bold" className="size-3.5" />
                    Quick add
                  </button>
                </div>

                {query.trim() ? (
                  <ul className="mt-3 max-h-72 space-y-1 overflow-y-auto">
                    {results.map((food) => (
                      <li key={food.id}>
                        <FoodRow
                          food={food}
                          favorited={favoriteIds.has(food.id)}
                          onSelect={selectFood}
                          onToggleFavorite={toggleFavorite}
                        />
                      </li>
                    ))}
                    {results.length === 0 && (
                      <li className="rounded-lg border border-dashed border-ink-700 px-4 py-8 text-center text-sm text-paper-mute">
                        {searching ? (
                          "Searching…"
                        ) : searchFailed ? (
                          <span className="text-danger">
                            Search failed — check your connection and try again.
                          </span>
                        ) : (
                          <>
                            Nothing matches “{query}”.{" "}
                            <a
                              href={`/foods/new?name=${encodeURIComponent(query)}`}
                              className="font-medium text-paper underline underline-offset-4 hover:text-lime"
                            >
                              Create it as your own food
                            </a>
                            .
                          </>
                        )}
                      </li>
                    )}
                  </ul>
                ) : (
                  <div className="mt-4 max-h-80 space-y-5 overflow-y-auto">
                    {suggestions && suggestions.recipes.length > 0 && (
                      <section>
                        <h4 className="px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-paper-mute">
                          Your recipes
                        </h4>
                        <ul className="mt-1.5 space-y-1">
                          {suggestions.recipes.map((recipe) => (
                            <li key={recipe.id}>
                              <button
                                type="button"
                                onClick={() => {
                                  setView({ kind: "recipe", recipe });
                                  setError(null);
                                }}
                                className="btn-press flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors hover:border-ink-700 hover:bg-ink-850 active:bg-ink-850"
                              >
                                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-ink-800 text-paper-dim">
                                  <BowlFood className="size-5" />
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-medium text-paper">
                                    {recipe.name}
                                  </span>
                                  <span className="block text-[11px] text-paper-mute">
                                    {recipe.itemCount} ingredient{recipe.itemCount === 1 ? "" : "s"} ·
                                    per serving
                                  </span>
                                </span>
                                <span className="shrink-0 font-mono text-xs text-paper-dim tabular">
                                  {Math.round(recipe.perServing.kcal)} kcal
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}
                    {suggestions && (
                      <>
                        <Shelf
                          title="Favorites"
                          foods={suggestions.favorites}
                          favoriteIds={favoriteIds}
                          onSelect={selectFood}
                          onToggleFavorite={toggleFavorite}
                        />
                        <Shelf
                          title="Recent"
                          foods={suggestions.recents}
                          favoriteIds={favoriteIds}
                          onSelect={selectFood}
                          onToggleFavorite={toggleFavorite}
                        />
                        <Shelf
                          title="Frequent"
                          foods={suggestions.frequents.filter(
                            (f) =>
                              !suggestions.favorites.some((x) => x.id === f.id) &&
                              !suggestions.recents.slice(0, 4).some((x) => x.id === f.id)
                          )}
                          favoriteIds={favoriteIds}
                          onSelect={selectFood}
                          onToggleFavorite={toggleFavorite}
                        />
                      </>
                    )}
                    {!hasShelves && (
                      <p className="rounded-lg border border-dashed border-ink-700 px-4 py-8 text-center text-sm text-paper-mute">
                        {suggestions
                          ? "Search the library — foods you log will show up here for one-tap re-logging."
                          : "Loading your usual foods…"}
                      </p>
                    )}
                  </div>
                )}
                <p className="mt-3 text-center text-[10px] text-paper-mute">
                  Includes Open Food Facts data (ODbL)
                </p>
              </>
            )}

            {view.kind === "food" && (
              <FoodPortion
                food={view.food}
                grams={grams}
                setGrams={setGrams}
                pending={pending}
                error={error}
                onBack={backToBrowse}
                onSubmit={() => submitFood(view.food)}
              />
            )}

            {view.kind === "recipe" && (
              <div className="mt-4">
                <BackLink onClick={backToBrowse} />
                <div className="mt-3 rounded-xl border border-ink-700 bg-ink-850 px-4 py-3.5">
                  <p className="text-sm font-medium text-paper">{view.recipe.name}</p>
                  <p className="text-[11px] text-paper-mute">
                    per serving: {Math.round(view.recipe.perServing.kcal)} kcal · P{" "}
                    {view.recipe.perServing.protein.toFixed(1)} · C{" "}
                    {view.recipe.perServing.carbs.toFixed(1)} · F{" "}
                    {view.recipe.perServing.fat.toFixed(1)}
                  </p>
                </div>
                <div className="mt-4 space-y-2">
                  <label htmlFor="servings" className="field-label">
                    Servings
                  </label>
                  <input
                    id="servings"
                    type="number"
                    inputMode="decimal"
                    min={0.1}
                    max={100}
                    step="0.5"
                    autoFocus
                    value={servings}
                    onChange={(e) => setServings(e.target.value)}
                    className="field tabular"
                  />
                </div>
                {Number(servings) > 0 && (
                  <MacroPreview
                    macros={{
                      kcal: view.recipe.perServing.kcal * Number(servings),
                      protein: view.recipe.perServing.protein * Number(servings),
                      carbs: view.recipe.perServing.carbs * Number(servings),
                      fat: view.recipe.perServing.fat * Number(servings),
                      fibre: view.recipe.perServing.fibre * Number(servings),
                    }}
                  />
                )}
                {error && <p className="mt-3 text-sm text-danger">{error}</p>}
                <button
                  type="button"
                  onClick={() => submitRecipe(view.recipe)}
                  disabled={pending || !(Number(servings) > 0)}
                  className="btn-press mt-4 w-full rounded-xl bg-lime px-5 py-3 font-display text-sm font-bold uppercase tracking-wide text-lime-ink hover:bg-lime-deep disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {pending ? "Logging…" : "Log recipe"}
                </button>
              </div>
            )}

            {view.kind === "ai" && (
              <AiLogView
                meal={meal}
                entryDate={entryDate}
                onBack={backToBrowse}
                onLogged={reset}
              />
            )}

            {view.kind === "quick" && (
              <QuickAddForm
                pending={pending}
                error={error}
                onBack={backToBrowse}
                onSubmit={submitQuick}
              />
            )}

            {view.kind === "scan" && (
              <div className="mt-4">
                <BackLink onClick={backToBrowse} />
                <BarcodeScanner onDetected={handleBarcode} className="mt-3" />
              </div>
            )}

            {view.kind === "scanMiss" && (
              <div className="mt-4">
                <BackLink onClick={backToBrowse} />
                <div className="mt-3 rounded-lg border border-dashed border-ink-700 px-4 py-8 text-center text-sm text-paper-mute">
                  <p>
                    Barcode <span className="font-mono text-paper tabular">{view.code}</span>{" "}
                    isn&rsquo;t in the library yet.
                  </p>
                  <p className="mt-3 flex flex-wrap items-center justify-center gap-3">
                    <a
                      href={`/foods/new?barcode=${encodeURIComponent(view.code)}`}
                      className="btn-press rounded-lg bg-lime px-4 py-2 font-display text-xs font-bold uppercase tracking-wide text-lime-ink hover:bg-lime-deep"
                    >
                      Create this food
                    </a>
                    <button
                      type="button"
                      onClick={() => setView({ kind: "scan" })}
                      className="btn-press rounded-lg border border-ink-700 px-4 py-2 text-xs font-semibold text-paper-dim hover:text-paper"
                    >
                      Scan again
                    </button>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function FoodRow({
  food,
  favorited,
  onSelect,
  onToggleFavorite,
}: {
  food: Food;
  favorited: boolean;
  onSelect: (food: Food) => void;
  onToggleFavorite: (food: Food) => void;
}) {
  return (
    <div className="group/row flex items-center gap-1">
      <button
        type="button"
        onClick={() => onSelect(food)}
        className="btn-press flex min-w-0 flex-1 items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors hover:border-ink-700 hover:bg-ink-850 active:bg-ink-850"
      >
        <FoodImage src={food.image_url} alt="" className="size-9 rounded-md" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-paper">{food.name}</span>
          <span className="block text-[11px] text-paper-mute">
            {food.brand ? `${food.brand} · ` : ""}
            {food.category} · per 100 g
          </span>
        </span>
        <span className="shrink-0 font-mono text-xs text-paper-dim tabular">
          {Math.round(food.kcal)} kcal
        </span>
      </button>
      <button
        type="button"
        onClick={() => onToggleFavorite(food)}
        aria-label={favorited ? `Unfavorite ${food.name}` : `Favorite ${food.name}`}
        aria-pressed={favorited}
        className={`btn-press shrink-0 rounded-md p-2 transition-colors ${
          favorited ? "text-lime" : "text-paper-mute hover:text-paper"
        }`}
      >
        <Star weight={favorited ? "fill" : "regular"} className="size-4" />
      </button>
    </div>
  );
}

function Shelf({
  title,
  foods,
  favoriteIds,
  onSelect,
  onToggleFavorite,
}: {
  title: string;
  foods: Food[];
  favoriteIds: Set<string>;
  onSelect: (food: Food) => void;
  onToggleFavorite: (food: Food) => void;
}) {
  if (foods.length === 0) return null;
  return (
    <section>
      <h4 className="px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-paper-mute">
        {title}
      </h4>
      <ul className="mt-1.5 space-y-1">
        {foods.map((food) => (
          <li key={food.id}>
            <FoodRow
              food={food}
              favorited={favoriteIds.has(food.id)}
              onSelect={onSelect}
              onToggleFavorite={onToggleFavorite}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="-m-2 inline-block p-2 text-xs font-medium text-paper-mute underline-offset-4 hover:text-paper hover:underline"
    >
      ← back
    </button>
  );
}

function MacroPreview({
  macros,
}: {
  macros: { kcal: number; protein: number; carbs: number; fat: number; fibre: number };
}) {
  return (
    <dl className="mt-4 grid grid-cols-3 gap-x-1 gap-y-3 rounded-xl bg-lime/[0.07] px-3 py-3 text-center ring-1 ring-inset ring-lime/20 sm:grid-cols-5">
      {(
        [
          ["kcal", macros.kcal, 0],
          ["protein", macros.protein, 1],
          ["carbs", macros.carbs, 1],
          ["fat", macros.fat, 1],
          ["fibre", macros.fibre, 1],
        ] as const
      ).map(([label, value, dp]) => (
        <div key={label}>
          <dt className="text-[10px] uppercase tracking-wide text-paper-mute">{label}</dt>
          <dd className="mt-0.5 font-mono text-sm font-semibold text-paper tabular">
            {value.toFixed(dp)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function FoodPortion({
  food,
  grams,
  setGrams,
  pending,
  error,
  onBack,
  onSubmit,
}: {
  food: Food;
  grams: string;
  setGrams: (v: string) => void;
  pending: boolean;
  error: string | null;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const portion = macrosForPortion(food, Number(grams) || 0);
  const portionMicros = microsForPortion(food, Number(grams) || 0);
  const providedMicros = MICRO_KEYS.filter((key) => food[key] != null);

  return (
    <div className="mt-4">
      <BackLink onClick={onBack} />
      <div className="mt-3 rounded-xl border border-ink-700 bg-ink-850 px-4 py-3.5">
        <p className="text-sm font-medium text-paper">{food.name}</p>
        <p className="text-[11px] text-paper-mute">
          per 100 g: {Math.round(food.kcal)} kcal · P {food.protein_g} · C {food.carbs_g} · F{" "}
          {food.fat_g} · Fb {food.fibre_g}
        </p>
      </div>
      <div className="mt-4 space-y-2">
        <label htmlFor="grams" className="field-label">
          Amount (grams)
        </label>
        <input
          id="grams"
          type="number"
          inputMode="decimal"
          min={1}
          max={5000}
          step="1"
          autoFocus
          value={grams}
          onChange={(e) => setGrams(e.target.value)}
          className="field tabular"
        />
      </div>

      <MacroPreview macros={portion} />

      {providedMicros.length > 0 && (
        <details className="group mt-3">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-paper-mute transition-colors hover:text-paper [&::-webkit-details-marker]:hidden">
            <CaretRight weight="bold" className="size-3 transition-transform group-open:rotate-90" />
            Micronutrients in this portion
          </summary>
          <ul className="mt-2 max-h-40 divide-y divide-ink-800/70 overflow-y-auto rounded-lg border border-ink-800">
            {providedMicros.map((key) => {
              const value = portionMicros[key];
              if (value == null) return null;
              const pct = percentDv(key, value);
              return (
                <li
                  key={key}
                  className="flex items-baseline justify-between gap-3 px-3 py-1.5 text-xs"
                >
                  <span className="text-paper-dim">{MICRONUTRIENTS[key].label}</span>
                  <span className="font-mono text-paper tabular">
                    {formatAmount(value)} {MICRONUTRIENTS[key].unit}
                    {pct != null && <span className="text-paper-mute"> · {pct}% DV</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </details>
      )}

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      <button
        type="button"
        onClick={onSubmit}
        disabled={pending || !(Number(grams) > 0)}
        className="btn-press mt-4 w-full rounded-xl bg-lime px-5 py-3 font-display text-sm font-bold uppercase tracking-wide text-lime-ink hover:bg-lime-deep disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? "Logging…" : `Log ${grams || 0} g`}
      </button>
    </div>
  );
}

function QuickAddForm({
  pending,
  error,
  onBack,
  onSubmit,
}: {
  pending: boolean;
  error: string | null;
  onBack: () => void;
  onSubmit: (fd: FormData) => void;
}) {
  return (
    <form
      className="mt-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
    >
      <BackLink onClick={onBack} />
      <p className="mt-3 text-sm text-paper-dim">
        Log calories without picking a food — macros are optional, micronutrients stay unknown.
      </p>
      <div className="mt-4 space-y-4">
        <div className="space-y-2">
          <label htmlFor="quick_name" className="field-label">
            Label (optional)
          </label>
          <input
            id="quick_name"
            name="quick_name"
            maxLength={80}
            placeholder="e.g. Restaurant dinner"
            className="field"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="quick_kcal" className="field-label">
            Calories (kcal)
          </label>
          <input
            id="quick_kcal"
            name="quick_kcal"
            type="number"
            inputMode="decimal"
            min={0}
            max={10000}
            step="1"
            required
            autoFocus
            className="field tabular"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              ["quick_protein_g", "Protein (g)"],
              ["quick_carbs_g", "Carbs (g)"],
              ["quick_fat_g", "Fat (g)"],
              ["quick_fibre_g", "Fibre (g)"],
            ] as const
          ).map(([name, label]) => (
            <div key={name} className="space-y-2">
              <label htmlFor={name} className="field-label">
                {label}
              </label>
              <input
                id={name}
                name={name}
                type="number"
                inputMode="decimal"
                min={0}
                max={2000}
                step="0.1"
                className="field tabular"
              />
            </div>
          ))}
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="btn-press mt-4 w-full rounded-xl bg-lime px-5 py-3 font-display text-sm font-bold uppercase tracking-wide text-lime-ink hover:bg-lime-deep disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? "Logging…" : "Quick add"}
      </button>
    </form>
  );
}
