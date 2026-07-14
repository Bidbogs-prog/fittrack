import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import type { Food } from "@/lib/types";
import { FoodForm } from "../food-form";

export const metadata = { title: "Admin · Edit food" };

export default async function EditFoodPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ supabase }, { id }] = await Promise.all([requireAdmin(), params]);

  const { data: food } = await supabase.from("foods").select("*").eq("id", id).maybeSingle();
  if (!food) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/admin/foods"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-paper-mute hover:text-paper"
      >
        <ArrowLeft className="size-3.5" weight="bold" />
        Back to library
      </Link>
      <section className="rounded-2xl border border-ink-800 bg-ink-900/60 p-6">
        <h2 className="mb-5 font-display text-lg font-semibold tracking-tight text-paper">
          Edit “{(food as Food).name}”
        </h2>
        <FoodForm food={food as Food} />
      </section>
    </div>
  );
}
