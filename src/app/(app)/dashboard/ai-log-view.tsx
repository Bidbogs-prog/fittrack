"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, Sparkle, X } from "@phosphor-icons/react";
import { macrosForPortion, round1 } from "@/lib/nutrition";
import type { MealType } from "@/lib/types";
import { logAiMeal, parseMeal, type AiMealItem } from "./ai-log";

/**
 * "Describe your meal" AI logging (roadmap 1.1), shown inside the add-food
 * dialog. Two stages: free text and/or photo goes to the parseMeal action,
 * then every parsed item is reviewed — library match or AI estimate,
 * portion editable — before anything is saved.
 */

interface ReviewItem {
  base: AiMealItem;
  /** A food id from base.matches, or "est" for the AI estimate. */
  source: string;
  grams: string;
}

/** Longest side of an uploaded photo after client-side downscaling. */
const PHOTO_MAX_PX = 1280;

async function compressPhoto(file: File): Promise<Blob | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("undecodable image"));
      img.src = url;
    });
    const scale = Math.min(1, PHOTO_MAX_PX / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Whole-row macros for the current source + grams. */
function rowMacros(item: ReviewItem) {
  const grams = Number(item.grams) || 0;
  const food = item.base.matches.find((f) => f.id === item.source);
  if (food) return macrosForPortion(food, grams);
  // Estimate rows scale linearly from the AI's original portion.
  const f = item.base.grams > 0 ? grams / item.base.grams : 0;
  const est = item.base.est;
  return {
    kcal: est.kcal * f,
    protein: est.protein_g * f,
    carbs: est.carbs_g * f,
    fat: est.fat_g * f,
    fibre: est.fibre_g * f,
  };
}

export function AiLogView({
  meal,
  entryDate,
  onBack,
  onLogged,
}: {
  meal: MealType;
  entryDate: string;
  onBack: () => void;
  onLogged: () => void;
}) {
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [items, setItems] = useState<ReviewItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function analyze() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("description", description);
      if (photo) {
        const compressed = await compressPhoto(photo);
        if (compressed) fd.set("photo", compressed, "meal.jpg");
        else if (!description.trim()) {
          setError("Couldn't read that photo — describe the meal in words instead.");
          return;
        }
      }
      const res = await parseMeal(fd);
      if (res.items == null) setError(res.error);
      else {
        setItems(
          res.items.map((base) => ({
            base,
            source: base.matches[0]?.id ?? "est",
            grams: String(base.grams),
          }))
        );
      }
    });
  }

  function log() {
    if (!items) return;
    setError(null);
    startTransition(async () => {
      const res = await logAiMeal({
        meal,
        entryDate,
        items: items.map((item) => {
          const food = item.base.matches.find((f) => f.id === item.source);
          if (food) return { food_id: food.id, grams: Number(item.grams), name: food.name, est: null };
          const m = rowMacros(item);
          return {
            food_id: null,
            grams: null,
            name: item.base.name,
            est: {
              kcal: round1(m.kcal),
              protein_g: round1(m.protein),
              carbs_g: round1(m.carbs),
              fat_g: round1(m.fat),
              fibre_g: round1(m.fibre),
            },
          };
        }),
      });
      if (res.error) setError(res.error);
      else onLogged();
    });
  }

  function patchItem(index: number, patch: Partial<ReviewItem>) {
    setItems((prev) => prev?.map((item, i) => (i === index ? { ...item, ...patch } : item)) ?? null);
  }

  const allValid = items != null && items.length > 0 && items.every((i) => Number(i.grams) > 0);
  const totalKcal = items?.reduce((sum, item) => sum + rowMacros(item).kcal, 0) ?? 0;

  if (items === null) {
    return (
      <div className="mt-4">
        <button
          type="button"
          onClick={onBack}
          className="-m-2 inline-block p-2 text-xs font-medium text-paper-mute underline-offset-4 hover:text-paper hover:underline"
        >
          ← back
        </button>
        <p className="mt-3 text-sm text-paper-dim">
          Describe the meal in your own words — any language — or snap a photo. The coach splits it
          into foods you confirm before anything is logged.
        </p>
        <textarea
          autoFocus
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="e.g. tagine de poulet aux olives, un petit khobz, thé à la menthe avec 2 sucres"
          className="field mt-4 h-auto resize-none py-3 leading-relaxed"
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
        />
        <div className="mt-3 flex items-center gap-2">
          {photo ? (
            <span className="inline-flex max-w-full items-center gap-2 rounded-lg border border-ink-700 bg-ink-850 py-1.5 pl-3 pr-1.5 text-xs text-paper-dim">
              <Camera weight="bold" className="size-3.5 shrink-0 text-lime" />
              <span className="truncate">Photo attached</span>
              <button
                type="button"
                onClick={() => {
                  setPhoto(null);
                  if (fileRef.current) fileRef.current.value = "";
                }}
                aria-label="Remove photo"
                className="btn-press rounded p-1 text-paper-mute hover:text-paper"
              >
                <X weight="bold" className="size-3" />
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="btn-press inline-flex items-center gap-1.5 rounded-lg border border-ink-700 px-3 py-2 text-xs font-semibold text-paper-dim transition-colors hover:border-lime/50 hover:text-lime"
            >
              <Camera weight="bold" className="size-3.5" />
              Add a photo
            </button>
          )}
        </div>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <button
          type="button"
          onClick={analyze}
          disabled={pending || (!description.trim() && !photo)}
          className="btn-press mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-lime px-5 py-3 font-display text-sm font-bold uppercase tracking-wide text-lime-ink hover:bg-lime-deep disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Sparkle weight="bold" className="size-4" />
          {pending ? "Reading your meal…" : "Analyse meal"}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => {
          setItems(null);
          setError(null);
        }}
        className="-m-2 inline-block p-2 text-xs font-medium text-paper-mute underline-offset-4 hover:text-paper hover:underline"
      >
        ← edit description
      </button>
      <ul className="mt-3 space-y-2">
        {items.map((item, index) => {
          const macros = rowMacros(item);
          return (
            <li
              key={`${item.base.name}-${index}`}
              className="rounded-xl border border-ink-700 bg-ink-850 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 text-sm font-medium text-paper">
                  {item.base.name}
                  {item.base.portion && (
                    <span className="ml-2 text-[11px] font-normal text-paper-mute">
                      {item.base.portion}
                    </span>
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => setItems((prev) => prev?.filter((_, i) => i !== index) ?? null)}
                  aria-label={`Remove ${item.base.name}`}
                  className="btn-press -m-1 shrink-0 rounded-md p-1.5 text-paper-mute hover:text-paper"
                >
                  <X weight="bold" className="size-3.5" />
                </button>
              </div>
              <select
                value={item.source}
                onChange={(e) => patchItem(index, { source: e.target.value })}
                aria-label={`Data source for ${item.base.name}`}
                className="field mt-2 text-xs"
              >
                {item.base.matches.map((food) => (
                  <option key={food.id} value={food.id}>
                    {food.brand ? `${food.name} — ${food.brand}` : food.name} ·{" "}
                    {Math.round(food.kcal)} kcal/100 g
                  </option>
                ))}
                <option value="est">AI estimate · {Math.round(item.base.est.kcal)} kcal as described</option>
              </select>
              <div className="mt-2 flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-paper-mute">
                  <input
                    type="number"
                    inputMode="decimal"
                    min={1}
                    max={5000}
                    value={item.grams}
                    onChange={(e) => patchItem(index, { grams: e.target.value })}
                    aria-label={`Grams of ${item.base.name}`}
                    className="field w-24 py-2 text-sm tabular"
                  />
                  g
                </label>
                <span className="ml-auto font-mono text-xs text-paper-dim tabular">
                  {Math.round(macros.kcal)} kcal · P {round1(macros.protein)} · C{" "}
                  {round1(macros.carbs)} · F {round1(macros.fat)}
                </span>
              </div>
            </li>
          );
        })}
        {items.length === 0 && (
          <li className="rounded-lg border border-dashed border-ink-700 px-4 py-8 text-center text-sm text-paper-mute">
            Everything removed — go back and describe the meal again.
          </li>
        )}
      </ul>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      <button
        type="button"
        onClick={log}
        disabled={pending || !allValid}
        className="btn-press mt-4 w-full rounded-xl bg-lime px-5 py-3 font-display text-sm font-bold uppercase tracking-wide text-lime-ink hover:bg-lime-deep disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending
          ? "Logging…"
          : `Log ${items.length} item${items.length === 1 ? "" : "s"} · ${Math.round(totalKcal)} kcal`}
      </button>
      <p className="mt-2 text-center text-[10px] text-paper-mute">
        AI estimates can be off — check portions before logging.
      </p>
    </div>
  );
}
