import { createClient } from "@/lib/supabase/server";

/**
 * Distinct diary dates for one month ("?month=YYYY-MM") — feeds the
 * dashboard calendar picker so logged days can be marked.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub as string | undefined;
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const month = new URL(request.url).searchParams.get("month") ?? "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return Response.json({ error: "Invalid month" }, { status: 400 });
  }

  const [year, monthNum] = month.split("-").map(Number);
  const lastDay = new Date(year, monthNum, 0).getDate();

  const { data, error } = await supabase
    .from("diary_entries")
    .select("entry_date")
    .eq("user_id", userId)
    .gte("entry_date", `${month}-01`)
    .lte("entry_date", `${month}-${String(lastDay).padStart(2, "0")}`);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ days: [...new Set((data ?? []).map((r) => r.entry_date as string))] });
}
