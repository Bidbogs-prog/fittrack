"use client";

import { useEffect, useState } from "react";
import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { FoodImage } from "@/components/food-image";
import type { Food } from "@/lib/types";

/**
 * Search-driven food selector for server-action forms. Submits the chosen
 * food's id through a hidden input — the library is 5k+ foods, so options
 * are fetched from /api/foods/search instead of being rendered up front.
 */
export function FoodPicker({ name = "food_id" }: { name?: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Food[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [focused, setFocused] = useState(false);
  const [selected, setSelected] = useState<Food | null>(null);

  useEffect(() => {
    if (!focused || selected) return;
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
    }, query ? 250 : 0);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [focused, selected, query]);

  return (
    <div className="relative">
      <input type="hidden" name={name} value={selected?.id ?? ""} />
      {selected ? (
        <div className="field flex items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="block truncate text-sm text-paper">{selected.name}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              setQuery("");
            }}
            aria-label="Clear selected food"
            className="btn-press -m-1 shrink-0 rounded-md p-2 text-paper-mute hover:bg-ink-800 hover:text-paper"
          >
            <X className="size-4" weight="bold" />
          </button>
        </div>
      ) : (
        <>
          <MagnifyingGlass className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-paper-mute" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            placeholder="Search foods…"
            aria-label="Search foods"
            className="field pl-10"
          />
          {focused && (
            <ul className="absolute z-50 mt-2 max-h-[40dvh] w-full overflow-y-auto overscroll-contain rounded-xl border border-ink-700 bg-ink-900 p-1.5 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.8)]">
              {results.map((food) => (
                <li key={food.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setSelected(food);
                    }}
                    className="btn-press flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-ink-850"
                  >
                    <FoodImage src={food.image_url} alt="" className="size-9 rounded-md" />
                    <span className="min-w-0 flex-1">
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
                <li className="px-3 py-6 text-center text-xs text-paper-mute">
                  {searching ? (
                    "Searching…"
                  ) : searchFailed ? (
                    <span className="text-danger">Search failed — try again.</span>
                  ) : query ? (
                    `Nothing matches “${query}”.`
                  ) : (
                    "No foods yet."
                  )}
                </li>
              )}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
