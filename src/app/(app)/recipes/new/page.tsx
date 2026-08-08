import { WarningCircle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createRecipe } from "../actions";

export const metadata = { title: "New recipe" };

export default async function NewRecipePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [, { error }] = await Promise.all([requireUser(), searchParams]);

  return (
    <div className="space-y-7">
      <header>
        <Link
          href="/recipes"
          className="text-xs font-medium text-paper-mute underline-offset-4 hover:text-paper hover:underline"
        >
          ← Your recipes
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tighter text-paper md:text-4xl">
          New recipe
        </h1>
        <p className="mt-2 max-w-[60ch] text-sm text-paper-dim">
          Name it and say how many servings it makes — you&rsquo;ll add the
          ingredients next.
        </p>
      </header>

      <form action={createRecipe} className="max-w-xl space-y-5">
        {error && (
          <p className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/[0.08] px-3.5 py-3 text-sm text-danger">
            <WarningCircle className="mt-0.5 size-4 shrink-0" weight="bold" />
            <span className="min-w-0 break-words">{error}</span>
          </p>
        )}
        <div className="space-y-2">
          <label htmlFor="name" className="field-label">Name</label>
          <input
            id="name"
            name="name"
            required
            minLength={2}
            maxLength={120}
            placeholder="e.g. Sunday chicken tagine"
            className="field"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="servings" className="field-label">Servings it makes</label>
          <input
            id="servings"
            name="servings"
            type="number"
            inputMode="decimal"
            min={0.5}
            max={100}
            step="0.5"
            defaultValue="4"
            required
            className="field tabular"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="description" className="field-label">Notes (optional)</label>
          <textarea
            id="description"
            name="description"
            maxLength={500}
            rows={3}
            className="field resize-y"
          />
        </div>
        <button
          type="submit"
          className="btn-press w-full rounded-xl bg-lime px-5 py-3 font-display text-sm font-bold uppercase tracking-wide text-lime-ink hover:bg-lime-deep sm:w-auto sm:px-8"
        >
          Create &amp; add ingredients
        </button>
      </form>
    </div>
  );
}
