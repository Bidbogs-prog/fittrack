import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Food } from "@/lib/types";

/**
 * Barcode lookup against the foods table (populated by the OFF import and
 * user-created foods). A user's private food wins over a global row with
 * the same barcode — it's their correction of the imported data.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const code = request.nextUrl.searchParams.get("code") ?? "";
  if (!/^\d{6,14}$/.test(code)) {
    return Response.json({ error: "Invalid barcode" }, { status: 400 });
  }

  const { data: matches } = await supabase
    .from("foods")
    .select("*")
    .eq("barcode", code)
    .limit(2);

  const foods = (matches ?? []) as Food[];
  const food = foods.find((f) => f.owner_id != null) ?? foods[0] ?? null;
  return Response.json({ food });
}
