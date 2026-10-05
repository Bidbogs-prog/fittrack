"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { applyAiEdits, logAiMeal, parseMeal, type AiEdit, type AiMealItem } from "@/app/(app)/dashboard/ai-log";
import { track } from "@/lib/analytics";
import { MEAL_DEFAULT_MIN, mealForMinutes, minutesOfDate } from "@/lib/day-time";
import { macrosForPortion, round1, type Macros } from "@/lib/nutrition";
import { enqueue } from "@/lib/offline-queue";
import { useClientValue } from "@/lib/use-client-clock";
import type { Food, MealType } from "@/lib/types";

/**
 * Shared state for logging on the orbit (Today + Coach): voice capture,
 * AI parsing, and the confirm sheet. Every source — voice, text, photo,
 * barcode — lands in the same sheet, and nothing is written until the
 * user confirms (parseMeal/logAiMeal in dashboard/ai-log.ts).
 */

export type LogSource = "voice" | "text" | "photo" | "barcode";

export interface ReviewItem {
  key: string;
  base: AiMealItem;
  /** A food id from base.matches, or "est" for the AI estimate. */
  source: string;
  grams: string;
}

/** Proposed diary changes awaiting confirmation; `then` = new items to add after. */
export interface PendingEdits {
  transcript: string;
  edits: AiEdit[];
  then: AiMealItem[];
}

export interface PendingLog {
  transcript: string | null;
  source: LogSource;
  meal: MealType;
  minutes: number;
  items: ReviewItem[];
}

/** Whole-row macros for the current source + grams. */
export function reviewMacros(item: ReviewItem): Macros {
  const grams = Number(item.grams) || 0;
  const food = item.base.matches.find((f) => f.id === item.source);
  if (food) return macrosForPortion(food, grams);
  // Estimates scale linearly from the AI's original portion.
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

/* Minimal Web Speech API typing (not in lib.dom). */
interface SpeechResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<SpeechResultLike> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SpeechCtor = new () => SpeechRecognitionLike;

function speechCtor(): SpeechCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const SPEECH_LANG: Record<string, string> = { en: "en-US", fr: "fr-FR", "ar-MA": "ar-MA", ar: "ar-MA" };

const QUESTION_PREFIXES = [
  "why", "how", "what", "should", "can", "could", "is ", "am i", "do ", "does", "when", "which",
  "any ", "ideas", "suggest", "pourquoi", "comment", "quoi", "que ", "quel", "est-ce", "combien",
  "dois", "peux", "idée", "علاش", "كيفاش", "واش", "شنو", "اشنو", "هل", "لماذا", "كيف", "ماذا", "ما ",
];

/** Diary verbs: "can you remove the rice?" is a request, not a question for the coach. */
const DIARY_VERBS =
  /\b(add|log|remove|delete|undo|change|move|replace|swap|edit|update|ajoute|enl[eè]ve|supprime|retire|modifie|change|d[ée]place|remplace|zid|7yed|bddel|bdl)\b|احذف|امسح|حيد|زيد|بدل|غيّر|أضف/;

/** Rough intent split for the composer: questions go to the coach. */
export function looksLikeQuestion(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (DIARY_VERBS.test(t)) return false;
  if (/[?؟]\s*$/.test(t)) return true;
  return QUESTION_PREFIXES.some((p) => t.startsWith(p));
}

interface LogContextValue {
  entryDate: string;
  isToday: boolean;
  /** Entry ids that appeared after this view mounted (just logged). */
  freshIds: Set<string>;

  listening: boolean;
  interim: string;
  voiceSupported: boolean;
  startListening: (onFinal?: (text: string) => void) => void;
  stopListening: () => void;

  parsing: boolean;
  error: string | null;
  notice: string | null;
  clearMessages: () => void;
  submitText: (text: string, source?: LogSource) => void;
  submitPhoto: (file: File) => void;
  addFood: (food: Food, grams: number) => void;
  setError: (message: string | null) => void;

  editSheet: PendingEdits | null;
  confirmEdits: () => void;
  cancelEdits: () => void;

  sheet: PendingLog | null;
  updateItem: (key: string, patch: Partial<ReviewItem>) => void;
  removeItem: (key: string) => void;
  setMeal: (meal: MealType) => void;
  confirm: () => void;
  cancel: () => void;
  confirming: boolean;
}

const LogContext = createContext<LogContextValue | null>(null);

export function useLog(): LogContextValue {
  const ctx = useContext(LogContext);
  if (!ctx) throw new Error("useLog must be used inside <LogProvider>");
  return ctx;
}

export function LogProvider({
  entryDate,
  isToday,
  entryIds,
  children,
}: {
  entryDate: string;
  isToday: boolean;
  entryIds: string[];
  children: React.ReactNode;
}) {
  const t = useTranslations("log");
  const locale = useLocale();
  const router = useRouter();

  // Ids present on mount; anything new since then was just logged.
  const [initialIds] = useState(() => new Set(entryIds));
  const freshIds = useMemo(
    () => new Set(entryIds.filter((id) => !initialIds.has(id))),
    [entryIds, initialIds]
  );

  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const voiceSupported = useClientValue(() => speechCtor() != null, false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const liveRef = useRef("");

  const [parsing, startParse] = useTransition();
  const [confirming, startConfirm] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sheet, setSheet] = useState<PendingLog | null>(null);
  const [editSheet, setEditSheet] = useState<PendingEdits | null>(null);
  const seq = useRef(0);

  const clearMessages = useCallback(() => {
    setError(null);
    setNotice(null);
  }, []);

  const openSheet = useCallback(
    (items: AiMealItem[], source: LogSource, transcript: string | null, matchFirst = true) => {
      const nowMin = minutesOfDate(new Date());
      const meal = mealForMinutes(nowMin);
      setSheet({
        transcript,
        source,
        meal,
        minutes: isToday ? nowMin : MEAL_DEFAULT_MIN[meal],
        items: items.map((base) => ({
          key: `i${++seq.current}`,
          base,
          source: matchFirst ? (base.matches[0]?.id ?? "est") : "est",
          grams: String(base.grams),
        })),
      });
    },
    [isToday]
  );

  const submitText = useCallback(
    (text: string, source: LogSource = "text") => {
      const message = text.trim();
      if (!message) return;
      clearMessages();
      if (looksLikeQuestion(message)) {
        track("composer_routed_to_coach", { source });
        router.push(`/coach?c=new&q=${encodeURIComponent(message.slice(0, 2000))}`);
        return;
      }
      startParse(async () => {
        const fd = new FormData();
        fd.set("description", message);
        fd.set("entry_date", entryDate);
          try {
          const res = await parseMeal(fd);
          if (res.items != null && res.edits.length > 0) {
            setEditSheet({ transcript: message, edits: res.edits, then: res.items });
          } else if (res.items == null && res.toCoach) {
            track("composer_routed_to_coach", { source, by: "intent" });
            router.push(`/coach?c=new&q=${encodeURIComponent(message.slice(0, 2000))}`);
          } else if (res.items == null) setError(res.error);
          else openSheet(res.items, source, message);
        } catch {
          setError(t("offlineParse"));
        }
      });
    },
    [clearMessages, entryDate, openSheet, router, t]
  );

  const cancelEdits = useCallback(() => setEditSheet(null), []);

  const confirmEdits = useCallback(() => {
    const current = editSheet;
    if (!current) return;
    setError(null);
    startConfirm(async () => {
      try {
        const res = await applyAiEdits({
          edits: current.edits.map((x) => ({
            entryId: x.entryId,
            action: x.action,
            grams: x.grams,
            servings: x.servings,
            toMeal: x.toMeal,
          })),
        });
        if (res.error) {
          setError(res.error);
          return;
        }
        track("orbit_entries_edited", {
          deleted: current.edits.filter((x) => x.action === "delete").length,
          updated: current.edits.filter((x) => x.action === "update").length,
        });
        setEditSheet(null);
        if (current.then.length > 0) openSheet(current.then, "text", current.transcript);
        router.refresh();
      } catch {
        setError(t("offlineParse"));
      }
    });
  }, [editSheet, openSheet, router, t]);

  const submitPhoto = useCallback(
    (file: File) => {
      clearMessages();
      startParse(async () => {
        const compressed = await compressPhoto(file);
        if (!compressed) {
          setError(t("photoUnreadable"));
          return;
        }
        const fd = new FormData();
        fd.set("photo", compressed, "meal.jpg");
        try {
          const res = await parseMeal(fd);
          if (res.items == null) setError(res.error);
          else openSheet(res.items, "photo", null);
        } catch {
          setError(t("offlineParse"));
        }
      });
    },
    [clearMessages, openSheet, t]
  );

  const addFood = useCallback(
    (food: Food, grams: number) => {
      clearMessages();
      const m = macrosForPortion(food, grams);
      openSheet(
        [
          {
            name: food.name,
            portion: "",
            grams,
            est: {
              kcal: round1(m.kcal),
              protein_g: round1(m.protein),
              carbs_g: round1(m.carbs),
              fat_g: round1(m.fat),
              fibre_g: round1(m.fibre),
            },
            matches: [food],
          },
        ],
        "barcode",
        null
      );
    },
    [clearMessages, openSheet]
  );

  const stopListening = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const startListening = useCallback(
    (onFinal?: (text: string) => void) => {
      const Ctor = speechCtor();
      if (!Ctor) {
        setError(t("voiceUnsupported"));
        return;
      }
      if (recRef.current) return;
      clearMessages();
      const rec = new Ctor();
      rec.lang = SPEECH_LANG[locale] ?? "en-US";
      rec.interimResults = true;
      rec.continuous = true;
      let finalText = "";
      liveRef.current = "";
      rec.onresult = (e) => {
        let live = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalText += r[0].transcript + " ";
          else live += r[0].transcript;
        }
        liveRef.current = (finalText + live).trim();
        setInterim(liveRef.current);
      };
      rec.onerror = (e) => {
        if (e.error === "aborted" || e.error === "no-speech") return;
        // not-allowed: the user (or OS) blocked the mic; service-not-allowed:
        // the platform refuses speech here (e.g. some installed iOS web apps).
        setError(
          t(e.error === "not-allowed" ? "voiceDenied" : e.error === "service-not-allowed" ? "voiceBlocked" : "voiceError")
        );
      };
      rec.onend = () => {
        recRef.current = null;
        setListening(false);
        setInterim("");
        const text = finalText.trim() || liveRef.current;
        liveRef.current = "";
        if (text) {
          track("voice_log_captured", {});
          if (onFinal) onFinal(text);
          else submitText(text, "voice");
        }
      };
      try {
        rec.start();
        recRef.current = rec;
        setListening(true);
      } catch {
        setError(t("voiceError"));
      }
    },
    [clearMessages, locale, submitText, t]
  );

  useEffect(() => () => recRef.current?.abort(), []);

  const updateItem = useCallback((key: string, patch: Partial<ReviewItem>) => {
    setSheet((prev) =>
      prev ? { ...prev, items: prev.items.map((i) => (i.key === key ? { ...i, ...patch } : i)) } : prev
    );
  }, []);

  const removeItem = useCallback((key: string) => {
    setSheet((prev) => (prev ? { ...prev, items: prev.items.filter((i) => i.key !== key) } : prev));
  }, []);

  const setMeal = useCallback(
    (meal: MealType) => {
      setSheet((prev) =>
        prev ? { ...prev, meal, minutes: isToday ? prev.minutes : MEAL_DEFAULT_MIN[meal] } : prev
      );
    },
    [isToday]
  );

  const cancel = useCallback(() => setSheet(null), []);

  const confirm = useCallback(() => {
    const current = sheet;
    if (!current || current.items.length === 0) return;
    if (!current.items.every((i) => Number(i.grams) > 0)) return;
    setError(null);
    const items = current.items.map((item) => {
      const food = item.base.matches.find((f) => f.id === item.source);
      if (food) return { food_id: food.id, grams: Number(item.grams), name: food.name, est: null };
      const m = reviewMacros(item);
      return {
        food_id: null,
        grams: null,
        name: item.base.name,
        recipe_id: item.base.recipe?.id ?? null,
        servings: item.base.recipe
          ? round1((item.base.recipe.servings * (Number(item.grams) || 0)) / (item.base.grams || 1))
          : null,
        est: {
          kcal: round1(m.kcal),
          protein_g: round1(m.protein),
          carbs_g: round1(m.carbs),
          fat_g: round1(m.fat),
          fibre_g: round1(m.fibre),
        },
      };
    });
    startConfirm(async () => {
      try {
        const res = await logAiMeal({ meal: current.meal, entryDate, items });
        if (res.error) {
          setError(res.error);
          return;
        }
        track("orbit_meal_logged", { items: items.length, source: current.source });
        setSheet(null);
        router.refresh();
      } catch {
        // Network gone: queue each row for OfflineSync, same as the dialog.
        for (const item of items) {
          if (item.food_id) {
            enqueue("food", {
              food_id: item.food_id,
              meal: current.meal,
              entry_date: entryDate,
              grams: String(item.grams),
            });
          } else if (item.est) {
            enqueue("quick", {
              meal: current.meal,
              entry_date: entryDate,
              quick_name: item.name,
              quick_kcal: String(item.est.kcal),
              quick_protein_g: String(item.est.protein_g),
              quick_carbs_g: String(item.est.carbs_g),
              quick_fat_g: String(item.est.fat_g),
              quick_fibre_g: String(item.est.fibre_g),
            });
          }
        }
        setSheet(null);
        setNotice(t("queuedOffline"));
      }
    });
  }, [entryDate, router, sheet, t]);

  const value: LogContextValue = {
    entryDate,
    isToday,
    freshIds,
    listening,
    interim,
    voiceSupported,
    startListening,
    stopListening,
    parsing,
    error,
    notice,
    clearMessages,
    submitText,
    submitPhoto,
    addFood,
    setError,
    editSheet,
    confirmEdits,
    cancelEdits,
    sheet,
    updateItem,
    removeItem,
    setMeal,
    confirm,
    cancel,
    confirming,
  };

  return <LogContext.Provider value={value}>{children}</LogContext.Provider>;
}
