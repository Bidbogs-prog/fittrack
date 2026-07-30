"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CaretRight, MagnifyingGlass, Plus, X } from "@phosphor-icons/react";
import { MICRONUTRIENTS, formatAmount, macrosForPortion, microsForPortion, percentDv } from "@/lib/nutrition";
import { MICRO_KEYS, type Food, type MealType } from "@/lib/types";
import { addDiaryEntry } from "./actions";

export function AddFoodDialog({
  meal,
  entryDate,
}: {
  meal: MealType;
  entryDate: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Food[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Food | null>(null);
  const [grams, setGrams] = useState("100");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);

  // The library is 5k+ foods, so search runs server-side (route handler).
  useEffect(() => {
    if (!open || selected) return;
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
        setSearching(false);
      } catch {
        if (!controller.signal.aborted) {
          setResults([]);
          setSearching(false);
        }
      }
    }, query ? 250 : 0);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [open, selected, query]);

  const portion = selected ? macrosForPortion(selected, Number(grams) || 0) : null;
  const portionMicros = selected ? microsForPortion(selected, Number(grams) || 0) : null;
  const providedMicros = selected ? MICRO_KEYS.filter((key) => selected[key] != null) : [];

  function reset() {
    setOpen(false);
    setQuery("");
    setSelected(null);
    setGrams("100");
    setError(null);
  }

  function submit() {
    if (!selected) return;
    const fd = new FormData();
    fd.set("food_id", selected.id);
    fd.set("meal", meal);
    fd.set("entry_date", entryDate);
    fd.set("grams", grams);
    startTransition(async () => {
      const res = await addDiaryEntry(fd);
      if (res?.error) setError(res.error);
      else reset();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-press inline-flex items-center gap-1.5 rounded-lg border border-ink-700 px-3 py-1.5 text-xs font-semibold text-paper-dim transition-colors hover:border-lime/50 hover:text-lime"
      >
        <Plus weight="bold" className="size-3.5" />
        Add food
      </button>

      {open && (
        <div
          className="overlay-fade fixed inset-0 z-50 flex items-end justify-center bg-ink-950/80 p-4 backdrop-blur-sm sm:items-center"
          onClick={reset}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Add food to ${meal}`}
            className="dialog-pop w-full max-w-md rounded-2xl border border-ink-700 bg-ink-900 p-5 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.05)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-semibold capitalize text-paper">
                Add to {meal}
              </h3>
              <button
                type="button"
                onClick={reset}
                aria-label="Close"
                className="btn-press rounded-md p-1.5 text-paper-mute hover:bg-ink-800 hover:text-paper"
              >
                <X className="size-4" weight="bold" />
              </button>
            </div>

            {!selected ? (
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
                <ul className="mt-3 max-h-72 space-y-1.5 overflow-y-auto">
                  {results.map((food) => (
                    <li key={food.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(food)}
                        className="btn-press flex w-full items-center justify-between gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors hover:border-ink-700 hover:bg-ink-850"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-paper">
                            {food.name}
                          </span>
                          <span className="block text-[11px] text-paper-mute">
                            {food.brand ? `${food.brand} · ` : ""}
                            {food.category} · per 100 g
                          </span>
                        </span>
                        <span className="shrink-0 font-mono text-xs text-paper-dim tabular">
                          {Math.round(food.kcal)} kcal
                        </span>
                      </button>
                    </li>
                  ))}
                  {results.length === 0 && (
                    <li className="rounded-lg border border-dashed border-ink-700 px-4 py-8 text-center text-sm text-paper-mute">
                      {searching ? (
                        "Searching…"
                      ) : query ? (
                        <>Nothing matches “{query}”. Ask your coach to add it to the library.</>
                      ) : (
                        "No foods in the library yet."
                      )}
                    </li>
                  )}
                </ul>
                <p className="mt-3 text-center text-[10px] text-paper-mute">
                  Includes Open Food Facts data (ODbL)
                </p>
              </>
            ) : (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="text-xs font-medium text-paper-mute underline-offset-4 hover:text-paper hover:underline"
                >
                  ← back to search
                </button>
                <div className="mt-3 rounded-xl border border-ink-700 bg-ink-850 px-4 py-3.5">
                  <p className="text-sm font-medium text-paper">{selected.name}</p>
                  <p className="text-[11px] text-paper-mute">
                    per 100 g: {Math.round(selected.kcal)} kcal · P {selected.protein_g} · C{" "}
                    {selected.carbs_g} · F {selected.fat_g} · Fb {selected.fibre_g}
                  </p>
                </div>
                <div className="mt-4 space-y-2">
                  <label htmlFor="grams" className="field-label">Amount (grams)</label>
                  <input
                    id="grams"
                    type="number"
                    min={1}
                    max={5000}
                    step="1"
                    autoFocus
                    value={grams}
                    onChange={(e) => setGrams(e.target.value)}
                    className="field tabular"
                  />
                </div>

                {portion && (
                  <dl className="mt-4 grid grid-cols-5 gap-1 rounded-xl bg-lime/[0.07] px-3 py-3 text-center ring-1 ring-inset ring-lime/20">
                    {(
                      [
                        ["kcal", portion.kcal, 0],
                        ["protein", portion.protein, 1],
                        ["carbs", portion.carbs, 1],
                        ["fat", portion.fat, 1],
                        ["fibre", portion.fibre, 1],
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
                )}

                {portionMicros && providedMicros.length > 0 && (
                  <details className="group mt-3">
                    <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-paper-mute transition-colors hover:text-paper [&::-webkit-details-marker]:hidden">
                      <CaretRight weight="bold" className="size-3 transition-transform group-open:rotate-90" />
                      Micronutrients in this portion
                    </summary>
                    <ul className="mt-2 max-h-40 divide-y divide-ink-800/70 overflow-y-auto rounded-lg border border-ink-800">
                      {providedMicros.map((key) => {
                        const value = portionMicros[key];
                        if (value == null) return null;
                        const pct = percentDv(key, value);
                        return (
                          <li key={key} className="flex items-baseline justify-between gap-3 px-3 py-1.5 text-xs">
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
                  onClick={submit}
                  disabled={pending || !(Number(grams) > 0)}
                  className="btn-press mt-4 w-full rounded-xl bg-lime px-5 py-3 font-display text-sm font-bold uppercase tracking-wide text-lime-ink hover:bg-lime-deep disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {pending ? "Logging…" : `Log ${grams || 0} g`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
