import type { NextRequest } from "next/server";
import { entryAmountLabel, entryMacros, entryName } from "@/lib/diary";
import { round1 } from "@/lib/nutrition";
import { createClient } from "@/lib/supabase/server";
import type { DiaryEntry, WeightLog } from "@/lib/types";

/**
 * Data export (roadmap 2.5): the user's diary or weight history as CSV or
 * JSON, streamed as a download. Macros are derived through the usual diary
 * helpers so exported numbers match what the app shows.
 */

function csvCell(value: string | number | null): string {
  if (value == null) return "";
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  return [headers.join(","), ...rows.map((r) => r.map(csvCell).join(","))].join("\n") + "\n";
}

function entryKind(e: DiaryEntry): string {
  if (e.food_id) return "food";
  if (e.recipe_id) return "recipe";
  return "quick-add";
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub as string | undefined;
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const what = params.get("what");
  const format = params.get("format") === "json" ? "json" : "csv";
  const today = new Date().toLocaleDateString("en-CA");

  if (what === "weight") {
    const { data } = await supabase
      .from("weight_logs")
      .select("log_date, weight_kg")
      .eq("user_id", userId)
      .order("log_date");
    const logs = (data ?? []) as Pick<WeightLog, "log_date" | "weight_kg">[];

    const body =
      format === "json"
        ? JSON.stringify(
            logs.map((l) => ({ date: l.log_date, weight_kg: Number(l.weight_kg) })),
            null,
            2
          )
        : toCsv(
            ["date", "weight_kg"],
            logs.map((l) => [l.log_date, Number(l.weight_kg)])
          );
    return new Response(body, {
      headers: {
        "Content-Type": format === "json" ? "application/json" : "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="fittrack-weight-${today}.${format}"`,
      },
    });
  }

  if (what === "diary") {
    const { data } = await supabase
      .from("diary_entries")
      .select("*, food:foods(*)")
      .eq("user_id", userId)
      .order("entry_date")
      .order("created_at");
    const entries = (data ?? []) as DiaryEntry[];

    const shaped = entries.map((e) => {
      const m = entryMacros(e);
      return {
        date: e.entry_date,
        meal: e.meal,
        kind: entryKind(e),
        name: entryName(e),
        brand: e.food?.brand ?? null,
        amount: entryAmountLabel(e),
        grams: e.grams != null ? Number(e.grams) : null,
        servings: e.servings != null ? Number(e.servings) : null,
        kcal: Math.round(m.kcal),
        protein_g: round1(m.protein),
        carbs_g: round1(m.carbs),
        fat_g: round1(m.fat),
        fibre_g: round1(m.fibre),
      };
    });

    const body =
      format === "json"
        ? JSON.stringify(shaped, null, 2)
        : toCsv(
            [
              "date",
              "meal",
              "kind",
              "name",
              "brand",
              "amount",
              "grams",
              "servings",
              "kcal",
              "protein_g",
              "carbs_g",
              "fat_g",
              "fibre_g",
            ],
            shaped.map((r) => [
              r.date,
              r.meal,
              r.kind,
              r.name,
              r.brand,
              r.amount,
              r.grams,
              r.servings,
              r.kcal,
              r.protein_g,
              r.carbs_g,
              r.fat_g,
              r.fibre_g,
            ])
          );
    return new Response(body, {
      headers: {
        "Content-Type": format === "json" ? "application/json" : "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="fittrack-diary-${today}.${format}"`,
      },
    });
  }

  return Response.json({ error: "Unknown export: use ?what=diary|weight" }, { status: 400 });
}
