import { WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { FOOD_CATEGORIES, type Food } from "@/lib/types";

/**
 * Create/edit form for a user's private food. Facts are per 100 g — the
 * project-wide convention every diary calculation depends on.
 */
export function UserFoodForm({
  action,
  food,
  error,
  defaults,
}: {
  action: (formData: FormData) => Promise<void>;
  food?: Food;
  error?: string;
  /** Prefills for the create form (e.g. from a failed search or barcode miss). */
  defaults?: { name?: string; barcode?: string };
}) {
  return (
    <form action={action} className="max-w-xl space-y-5">
      {food && <input type="hidden" name="id" value={food.id} />}

      {error && (
        <p className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/[0.08] px-3.5 py-3 text-sm text-danger">
          <WarningCircle className="mt-0.5 size-4 shrink-0" weight="bold" />
          <span className="min-w-0 break-words">{error}</span>
        </p>
      )}

      <div className="space-y-2">
        <label htmlFor="name" className="field-label">Name</label>
        <input
          id="name"
          name="name"
          required
          minLength={2}
          maxLength={120}
          defaultValue={food?.name ?? defaults?.name ?? ""}
          placeholder="e.g. Homemade granola"
          className="field"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="brand" className="field-label">Brand (optional)</label>
          <input
            id="brand"
            name="brand"
            maxLength={80}
            defaultValue={food?.brand ?? ""}
            className="field"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="category" className="field-label">Category</label>
          <select
            id="category"
            name="category"
            defaultValue={food?.category ?? "other"}
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

      <div className="space-y-2">
        <label htmlFor="barcode" className="field-label">Barcode (optional)</label>
        <input
          id="barcode"
          name="barcode"
          inputMode="numeric"
          pattern="\d{6,14}"
          maxLength={14}
          defaultValue={food?.barcode ?? defaults?.barcode ?? ""}
          placeholder="EAN / UPC digits"
          className="field tabular"
        />
        <p className="text-[11px] text-paper-mute">
          Set it and the barcode scanner will find this food next time.
        </p>
      </div>

      <fieldset className="space-y-4 rounded-xl border border-ink-800 p-4">
        <legend className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-paper-mute">
          Nutrition per 100 g
        </legend>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {(
            [
              ["kcal", "kcal", food?.kcal, 900, true],
              ["protein_g", "Protein (g)", food?.protein_g, 100, true],
              ["carbs_g", "Carbs (g)", food?.carbs_g, 100, true],
              ["fat_g", "Fat (g)", food?.fat_g, 100, true],
              ["fibre_g", "Fibre (g)", food?.fibre_g, 100, false],
            ] as const
          ).map(([name, label, value, max, required]) => (
            <div key={name} className="space-y-2">
              <label htmlFor={name} className="field-label">{label}</label>
              <input
                id={name}
                name={name}
                type="number"
                inputMode="decimal"
                min={0}
                max={max}
                step="0.1"
                required={required}
                defaultValue={value ?? (name === "fibre_g" ? "0" : "")}
                className="field tabular"
              />
            </div>
          ))}
        </div>
      </fieldset>

      <button
        type="submit"
        className="btn-press w-full rounded-xl bg-lime px-5 py-3 font-display text-sm font-bold uppercase tracking-wide text-lime-ink hover:bg-lime-deep sm:w-auto sm:px-8"
      >
        {food ? "Save changes" : "Create food"}
      </button>
    </form>
  );
}
