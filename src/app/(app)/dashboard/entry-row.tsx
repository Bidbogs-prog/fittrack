"use client";

import { useEffect, useState, useTransition } from "react";
import { Trash, X } from "@phosphor-icons/react";
import { entryAmountLabel, entryMacros, entryName, isFoodEntry } from "@/lib/diary";
import { macrosForPortion } from "@/lib/nutrition";
import { useFormatter, useTranslations } from "next-intl";
import { ActionError } from "@/components/action-error";
import { MEAL_TYPES, type DiaryEntry } from "@/lib/types";
import { deleteDiaryEntry, updateDiaryEntry } from "./actions";

/**
 * One diary line: tap to edit in place (portion, meal, or quick-add macros)
 * instead of the old delete-and-re-add dance.
 */
export function EntryRow({ entry }: { entry: DiaryEntry }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const m = entryMacros(entry);
  const food = isFoodEntry(entry) ? entry.food : null;

  const [grams, setGrams] = useState(String(entry.grams ?? ""));
  const [meal, setMeal] = useState(entry.meal);

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

  function save(fd: FormData) {
    fd.set("id", entry.id);
    fd.set("meal", meal);
    if (food) fd.set("grams", grams);
    startTransition(async () => {
      const res = await updateDiaryEntry(fd);
      if (res?.error) setError(res.error);
      else setOpen(false);
    });
  }

  const t = useTranslations("dashboard");
  const tMeal = useTranslations("meals");
  const tMacro = useTranslations("macros");
  const format = useFormatter();

  const preview = food ? macrosForPortion(food, Number(grams) || 0) : null;

  return (
    <>
      <div className="group flex items-center gap-3 px-5 py-3">
        <button
          type="button"
          onClick={() => {
            setGrams(String(entry.grams ?? ""));
            setMeal(entry.meal);
            setError(null);
            setOpen(true);
          }}
          className="btn-press min-w-0 flex-1 rounded-md text-start"
        >
          <p className="truncate text-sm font-medium text-paper">{entryName(entry)}</p>
          <p className="truncate text-[11px] text-paper-mute">
            {entryAmountLabel(entry)} · {tMacro("proteinShort")} {m.protein.toFixed(1)} ·{" "}
            {tMacro("carbsShort")} {m.carbs.toFixed(1)} · {tMacro("fatShort")}{" "}
            {m.fat.toFixed(1)} · {tMacro("fibreShort")} {m.fibre.toFixed(1)}
          </p>
        </button>
        <span className="font-mono text-sm text-paper-dim tabular">
          {format.number(Math.round(m.kcal))}
        </span>
        <form action={deleteDiaryEntry}>
          <input type="hidden" name="id" value={entry.id} />
          <button
            type="submit"
            aria-label={t("removeEntry", { name: entryName(entry) })}
            className="btn-press rounded-md p-2.5 text-paper-mute transition-opacity hover:bg-danger/10 hover:text-danger focus-visible:opacity-100 pointer-coarse:text-danger/80 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100"
          >
            <Trash className="size-4" />
          </button>
        </form>
      </div>

      {open && (
        <div
          className="overlay-fade fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 p-4 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("editEntry", { name: entryName(entry) })}
            className="dialog-pop max-h-[85dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-2xl border border-ink-700 bg-ink-900 p-5 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.05)]"
          >
            <div className="flex items-center justify-between">
              <h3 className="min-w-0 truncate font-display text-base font-semibold text-paper">
                {entryName(entry)}
              </h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("close")}
                className="btn-press rounded-md p-2.5 text-paper-mute hover:bg-ink-800 hover:text-paper"
              >
                <X className="size-4" weight="bold" />
              </button>
            </div>

            <form
              className="mt-4 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                save(new FormData(e.currentTarget));
              }}
            >
              <div className="space-y-2">
                <label htmlFor={`meal-${entry.id}`} className="field-label">
                  {t("meal")}
                </label>
                <select
                  id={`meal-${entry.id}`}
                  value={meal}
                  onChange={(e) => setMeal(e.target.value as DiaryEntry["meal"])}
                  className="field"
                >
                  {MEAL_TYPES.map((option) => (
                    <option key={option} value={option}>
                      {tMeal(option)}
                    </option>
                  ))}
                </select>
              </div>

              {food ? (
                <>
                  <div className="space-y-2">
                    <label htmlFor={`grams-${entry.id}`} className="field-label">
                      {t("amountGrams")}
                    </label>
                    <input
                      id={`grams-${entry.id}`}
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
                  {preview && (
                    <p className="text-[11px] text-paper-mute">
                      {format.number(Math.round(preview.kcal))} {tMacro("kcal")} ·{" "}
                      {tMacro("proteinShort")} {preview.protein.toFixed(1)} ·{" "}
                      {tMacro("carbsShort")} {preview.carbs.toFixed(1)} ·{" "}
                      {tMacro("fatShort")} {preview.fat.toFixed(1)} ·{" "}
                      {tMacro("fibreShort")} {preview.fibre.toFixed(1)}
                    </p>
                  )}
                </>
              ) : (
                <>
                  {entry.servings != null && (
                    <p className="text-[11px] text-paper-mute">
                      {t("recipeSnapshot", { amount: entryAmountLabel(entry) })}
                    </p>
                  )}
                  <div className="space-y-2">
                    <label htmlFor={`qname-${entry.id}`} className="field-label">
                      {t("label")}
                    </label>
                    <input
                      id={`qname-${entry.id}`}
                      name="quick_name"
                      defaultValue={entry.quick_name ?? ""}
                      maxLength={80}
                      className="field"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {(
                      [
                        ["quick_kcal", tMacro("kcal"), entry.quick_kcal, 10000],
                        ["quick_protein_g", tMacro("proteinGrams"), entry.quick_protein_g, 2000],
                        ["quick_carbs_g", tMacro("carbsGrams"), entry.quick_carbs_g, 2000],
                        ["quick_fat_g", tMacro("fatGrams"), entry.quick_fat_g, 2000],
                        ["quick_fibre_g", tMacro("fibreGrams"), entry.quick_fibre_g, 2000],
                      ] as const
                    ).map(([name, label, value, max]) => (
                      <div key={name} className="space-y-2">
                        <label htmlFor={`${name}-${entry.id}`} className="field-label">
                          {label}
                        </label>
                        <input
                          id={`${name}-${entry.id}`}
                          name={name}
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={max}
                          step="0.1"
                          required={name === "quick_kcal"}
                          defaultValue={value ?? ""}
                          className="field tabular"
                        />
                      </div>
                    ))}
                  </div>
                </>
              )}

              <ActionError error={error} />

              <button
                type="submit"
                disabled={pending || (food != null && !(Number(grams) > 0))}
                className="btn-press w-full rounded-xl bg-flame px-5 py-3 font-display text-sm font-bold uppercase tracking-wide text-flame-ink hover:bg-flame-deep disabled:cursor-not-allowed disabled:opacity-40"
              >
                {pending ? t("saving") : t("saveChanges")}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
