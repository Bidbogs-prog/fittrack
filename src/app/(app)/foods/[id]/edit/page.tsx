import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import type { Food } from "@/lib/types";
import { deleteUserFood, updateUserFood } from "../../actions";
import { UserFoodForm } from "../../user-food-form";

export const metadata = { title: "Edit food" };

export default async function EditFoodPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ supabase, userId }, { id }, { error }] = await Promise.all([
    requireUser(),
    params,
    searchParams,
  ]);

  const { data } = await supabase
    .from("foods")
    .select("*")
    .eq("id", id)
    .eq("owner_id", userId)
    .maybeSingle();
  if (!data) notFound();
  const food = data as Food;

  return (
    <div className="space-y-7">
      <header>
        <Link
          href="/foods?mine=1"
          className="text-xs font-medium text-paper-mute underline-offset-4 hover:text-paper hover:underline"
        >
          ← Your foods
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tighter text-paper md:text-4xl">
          Edit {food.name}
        </h1>
      </header>

      <UserFoodForm action={updateUserFood} food={food} error={error} />

      <footer className="max-w-xl border-t border-ink-800 pt-5">
        <form action={deleteUserFood}>
          <input type="hidden" name="id" value={food.id} />
          <button
            type="submit"
            className="btn-press rounded-lg border border-danger/40 px-4 py-2.5 text-xs font-semibold text-danger transition-colors hover:bg-danger/10"
          >
            Delete this food
          </button>
        </form>
        <p className="mt-2 text-[11px] text-paper-mute">
          Deleting also removes every diary entry that logged it.
        </p>
      </footer>
    </div>
  );
}
