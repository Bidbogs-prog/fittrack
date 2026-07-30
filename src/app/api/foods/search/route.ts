import type { NextRequest } from "next/server";
import { parseCategory, rankFoods } from "@/lib/foods";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const foods = await rankFoods(supabase, {
    q: params.get("q") ?? "",
    category: parseCategory(params.get("c")),
    limit: 12,
  });
  return Response.json({ foods });
}
