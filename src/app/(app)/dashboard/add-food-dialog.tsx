"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { MagnifyingGlass, Plus, X } from "@phosphor-icons/react";
import { macrosForPortion } from "@/lib/nutrition";
import type { Food, MealType } from "@/lib/types";
import { addDiaryEntry } from "./actions";

export function AddFoodDialog({
  foods,
  meal,
  entryDate,
}: {
  foods: Food[];
  meal: MealType;
  entryDate: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Food | null>(null);
  const [grams, setGrams] = useState("100");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const searchRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return foods.slice(0, 8);
    return foods
      .filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.brand?.toLowerCase().includes(q) ||
          f.category.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [foods, query]);

  const portion = selected ? macrosForPortion(selected, Number(grams) || 0) : null;

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
                      Nothing matches “{query}”. Ask your coach to add it to the library.
                    </li>
                  )}
                </ul>
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
