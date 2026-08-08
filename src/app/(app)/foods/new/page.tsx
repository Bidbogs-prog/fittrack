import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createUserFood } from "../actions";
import { UserFoodForm } from "../user-food-form";

export const metadata = { title: "New food" };

export default async function NewFoodPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; name?: string; barcode?: string }>;
}) {
  const [, params] = await Promise.all([requireUser(), searchParams]);

  return (
    <div className="space-y-7">
      <header>
        <Link
          href="/foods"
          className="text-xs font-medium text-paper-mute underline-offset-4 hover:text-paper hover:underline"
        >
          ← Food library
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tighter text-paper md:text-4xl">
          Create your own food
        </h1>
        <p className="mt-2 max-w-[60ch] text-sm text-paper-dim">
          Private to your account. Enter the label facts per 100 grams — your diary
          scales them to whatever portion you log.
        </p>
      </header>

      <UserFoodForm
        action={createUserFood}
        error={params.error}
        defaults={{ name: params.name, barcode: params.barcode }}
      />
    </div>
  );
}
