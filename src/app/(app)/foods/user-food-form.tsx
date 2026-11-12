import { getTranslations } from "next-intl/server";
import { StatusMessage } from "@/components/status-message";
import { FOOD_CATEGORIES, type Food } from "@/lib/types";

/**
 * Create/edit form for a user's private food. Facts are per 100 g — the
 * project-wide convention every diary calculation depends on.
 */
export async function UserFoodForm({
  action,
  food,
  error,
  defaults,
  from,
}: {
  action: (formData: FormData) => Promise<void>;
  food?: Food;
  error?: string;
  /** Prefills for the create form (e.g. from a failed search or barcode miss). */
  defaults?: { name?: string; barcode?: string };
  /** Where the form was opened from ("scan" = barcode miss: open the food after saving). */
  from?: string;
}) {
  const [t, tf] = await Promise.all([getTranslations("foodForm"), getTranslations("foods")]);
  return (
    <form action={action} className="max-w-xl space-y-5">
      {food && <input type="hidden" name="id" value={food.id} />}
      {from && <input type="hidden" name="from" value={from} />}

      {/* Status keys only (AUD-17): never echo text from the URL. */}
      <StatusMessage error={error} className="" />

      <div className="space-y-2">
        <label htmlFor="name" className="field-label">{t("name")}</label>
        <input
          id="name"
          name="name"
          required
          minLength={2}
          maxLength={120}
          defaultValue={food?.name ?? defaults?.name ?? ""}
          placeholder={t("namePlaceholder")}
          className="field"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="brand" className="field-label">{t("brand")}</label>
          <input
            id="brand"
            name="brand"
            maxLength={80}
            defaultValue={food?.brand ?? ""}
            className="field"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="category" className="field-label">{t("category")}</label>
          <select
            id="category"
            name="category"
            defaultValue={food?.category ?? "other"}
            className="field"
          >
            {FOOD_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {tf(`cat.${cat}`)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="serving_name" className="field-label">{t("servingName")}</label>
          <input
            id="serving_name"
            name="serving_name"
            maxLength={60}
            defaultValue={food?.serving_name ?? ""}
            placeholder={t("servingNamePlaceholder")}
            className="field"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="serving_grams" className="field-label">{t("servingGrams")}</label>
          <input
            id="serving_grams"
            name="serving_grams"
            type="number"
            inputMode="decimal"
            min={1}
            max={5000}
            step="0.1"
            defaultValue={food?.serving_grams ?? ""}
            placeholder={t("servingGramsPlaceholder")}
            className="field tabular"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="barcode" className="field-label">{t("barcode")}</label>
        <input
          id="barcode"
          name="barcode"
          inputMode="numeric"
          pattern="\d{6,14}"
          maxLength={14}
          defaultValue={food?.barcode ?? defaults?.barcode ?? ""}
          placeholder={t("barcodePlaceholder")}
          className="field tabular"
        />
        <p className="text-[11px] text-paper-mute">
          {t("barcodeHint")}
        </p>
      </div>

      <fieldset className="space-y-4 rounded-xl border border-ink-800 p-4">
        <legend className="px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-paper-mute">
          {t("per100")}
        </legend>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {(
            [
              ["kcal", t("kcal"), food?.kcal, 900, true],
              ["protein_g", t("protein"), food?.protein_g, 100, true],
              ["carbs_g", t("carbs"), food?.carbs_g, 100, true],
              ["fat_g", t("fat"), food?.fat_g, 100, true],
              ["fibre_g", t("fibre"), food?.fibre_g, 100, false],
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
        className="btn-press w-full rounded-xl btn-flame px-5 py-3 text-sm font-semibold sm:w-auto sm:px-8"
      >
        {food ? t("save") : t("create")}
      </button>
    </form>
  );
}
