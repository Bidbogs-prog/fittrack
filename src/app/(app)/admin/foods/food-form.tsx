import type { Food } from "@/lib/types";
import { FOOD_CATEGORIES } from "@/lib/types";
import { saveFood } from "../actions";

/**
 * Create/edit form for a food. Server component — the file input and number
 * fields need no client JS; saveFood handles upload + validation.
 */
export function FoodForm({ food }: { food?: Food }) {
  return (
    <form action={saveFood} className="space-y-5">
      {food && <input type="hidden" name="id" value={food.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <label htmlFor="name" className="field-label">Food name</label>
          <input
            id="name"
            name="name"
            required
            defaultValue={food?.name}
            placeholder="Chicken breast, raw"
            className="field"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="brand" className="field-label">Brand (optional)</label>
          <input id="brand" name="brand" defaultValue={food?.brand ?? ""} placeholder="—" className="field" />
        </div>
        <div className="space-y-2">
          <label htmlFor="category" className="field-label">Category</label>
          <select
            id="category"
            name="category"
            required
            defaultValue={food?.category ?? "protein"}
            className="field capitalize"
          >
            {FOOD_CATEGORIES.map((cat) => (
              <option key={cat} value={cat} className="capitalize">
                {cat.replace("-", " & ")}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset>
        <legend className="field-label mb-2">Nutritional facts per 100 g</legend>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {(
            [
              ["kcal", "Calories", food?.kcal],
              ["protein_g", "Protein (g)", food?.protein_g],
              ["carbs_g", "Carbs (g)", food?.carbs_g],
              ["fat_g", "Fat (g)", food?.fat_g],
              ["fibre_g", "Fibre (g)", food?.fibre_g],
            ] as const
          ).map(([name, label, value]) => (
            <div key={name} className="space-y-2">
              <label htmlFor={name} className="text-[11px] font-medium text-paper-mute">
                {label}
              </label>
              <input
                id={name}
                name={name}
                type="number"
                inputMode="decimal"
                min={0}
                step="0.1"
                required
                defaultValue={value ?? ""}
                placeholder="0"
                className="field tabular"
              />
            </div>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <label htmlFor="image" className="field-label">
          Photo {food?.image_url ? "(leave empty to keep the current one)" : "(optional, max 4 MB)"}
        </label>
        <input
          id="image"
          name="image"
          type="file"
          accept="image/*"
          className="block w-full text-sm text-paper-mute file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-ink-700 file:px-4 file:py-2.5 file:text-xs file:font-semibold file:text-paper hover:file:bg-ink-600"
        />
      </div>

      <button
        type="submit"
        className="btn-press rounded-xl bg-lime px-6 py-3 font-display text-sm font-bold uppercase tracking-wide text-lime-ink hover:bg-lime-deep"
      >
        {food ? "Save changes" : "Add to library"}
      </button>
    </form>
  );
}
