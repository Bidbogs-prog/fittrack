import Link from "next/link";
import { isAdmin, requireUser } from "@/lib/auth";
import { createUserFood } from "../actions";
import { UserFoodForm } from "../user-food-form";

export const metadata = { title: "New food" };

export default async function NewFoodPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; name?: string; barcode?: string; from?: string }>;
}) {
  const [{ supabase, userId }, params] = await Promise.all([requireUser(), searchParams]);
  const admin = await isAdmin(supabase, userId);
  const fromScan = params.from === "scan";

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
          {fromScan ? "Add this product" : admin ? "Add a food to the library" : "Create your own food"}
        </h1>
        <p className="mt-2 max-w-[60ch] text-sm text-paper-dim">
          {admin
            ? "You're an admin: it goes straight into the shared library for everyone."
            : "You can log it right away. It stays private to you until an admin reviews it, then it's shared with everyone."}{" "}
          Enter the label facts per 100 grams — your diary scales them to whatever portion you log.
        </p>
      </header>

      <UserFoodForm
        action={createUserFood}
        error={params.error}
        defaults={{ name: params.name, barcode: params.barcode }}
        from={fromScan ? "scan" : undefined}
      />
    </div>
  );
}
