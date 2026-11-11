import { Check, CheckCircle, WarningCircle, X } from "@phosphor-icons/react/dist/ssr";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Food } from "@/lib/types";
import { approveFood, rejectFood } from "../../actions";

export const metadata = { title: "Admin · Food review" };

type Pending = Food & { created_at: string };

/**
 * Foods users created, waiting to be shared. Approve = moves into the shared
 * library for everyone; reject = stays private to its creator.
 */
export default async function FoodReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; approved?: string; rejected?: string }>;
}) {
  const [{ supabase }, q] = await Promise.all([requireAdmin(), searchParams]);
  const { data } = await supabase
    .from("foods")
    .select("*")
    .eq("review_status", "pending")
    .order("created_at", { ascending: true })
    .limit(100);
  const foods = (data ?? []) as Pending[];

  // Submitter emails and barcode clashes with the shared library.
  const ownerIds = [...new Set(foods.map((f) => f.owner_id).filter((v): v is string => v != null))];
  const barcodes = [...new Set(foods.map((f) => f.barcode).filter((v): v is string => v != null))];
  const admin = createAdminClient();
  const [{ data: owners }, { data: clashes }] = await Promise.all([
    ownerIds.length && admin
      ? admin.from("profiles").select("id, email").in("id", ownerIds)
      : Promise.resolve({ data: [] as { id: string; email: string | null }[] }),
    barcodes.length
      ? supabase.from("foods").select("barcode, name").is("owner_id", null).in("barcode", barcodes)
      : Promise.resolve({ data: [] as { barcode: string; name: string }[] }),
  ]);
  const emailOf = new Map((owners ?? []).map((o) => [o.id, o.email]));
  const clashOf = new Map((clashes ?? []).map((c) => [c.barcode, c.name]));

  return (
    <div className="space-y-6">
      {(q.approved || q.rejected) && (
        <p role="status" className="flex items-start gap-2 rounded-lg border border-flame/25 bg-flame/[0.06] px-3.5 py-3 text-sm text-flame">
          <CheckCircle className="mt-0.5 size-4 shrink-0" weight="bold" />
          {q.approved ? <>&ldquo;{q.approved}&rdquo; is now in the shared library.</> : <>&ldquo;{q.rejected}&rdquo; rejected; it stays private to its creator.</>}
        </p>
      )}
      {q.error && (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/[0.08] px-3.5 py-3 text-sm text-danger">
          <WarningCircle className="mt-0.5 size-4 shrink-0" weight="bold" />
          {q.error}
        </p>
      )}
      <p className="text-xs text-paper-mute">
        Foods users created. They can already log them privately; approving shares them with everyone. Check the facts against the label (per 100 g).
      </p>
      {foods.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-ink-700 px-6 py-14 text-center text-sm text-paper-mute">
          Nothing to review.
        </p>
      ) : (
        <ul className="space-y-3">
          {foods.map((f) => {
            const clash = f.barcode ? clashOf.get(f.barcode) : undefined;
            return (
              <li key={f.id} className="rounded-2xl border border-ink-800 bg-ink-900/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p dir="auto" className="font-medium text-paper">
                      {f.name}
                      {f.brand && <span className="text-paper-mute"> · {f.brand}</span>}
                    </p>
                    <p className="mt-0.5 text-xs text-paper-mute">
                      {f.category}
                      {f.barcode && <> · <span className="font-mono">{f.barcode}</span></>}
                      {f.serving_name && <> · {f.serving_name} = {f.serving_grams} g</>}
                      {" · "}by {(f.owner_id && emailOf.get(f.owner_id)) ?? "a user"} · {new Date(f.created_at).toLocaleDateString("en-GB")}
                    </p>
                    <p className="mt-2 font-mono text-xs text-paper-dim tabular">
                      per 100 g: {f.kcal} kcal · P {f.protein_g} · C {f.carbs_g} · F {f.fat_g} · fibre {f.fibre_g}
                    </p>
                    {clash && (
                      <p className="mt-2 text-xs text-danger">
                        Barcode already in the library as &ldquo;{clash}&rdquo;: approving will fail. Reject this one.
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <form action={approveFood}>
                      <input type="hidden" name="id" value={f.id} />
                      <button type="submit" className="btn-press btn-flame inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold">
                        <Check weight="bold" className="size-3.5" />
                        Approve
                      </button>
                    </form>
                    <form action={rejectFood}>
                      <input type="hidden" name="id" value={f.id} />
                      <button type="submit" className="btn-press inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-ink-700 px-3 text-xs font-semibold text-paper-dim hover:text-danger">
                        <X weight="bold" className="size-3.5" />
                        Reject
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
