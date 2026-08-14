import { ArrowSquareOut, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { GOALS } from "@/lib/nutrition";
import type { Goal, PlanRequest } from "@/lib/types";
import { assignPlanToRequest, dismissPlanRequest, unassignPlanRequest } from "../actions";

export const metadata = { title: "Admin · Plan requests" };

interface AssignablePlan {
  id: string;
  name: string;
  goal: Goal;
}

function requestDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function AdminRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ supabase }, { error }] = await Promise.all([requireAdmin(), searchParams]);

  const [{ data: requestData }, { data: planData }, { data: assignedPlanData }] =
    await Promise.all([
      supabase
        .from("plan_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
      // Only unassigned admin-built plans can be handed out.
      supabase
        .from("meal_plans")
        .select("id, name, goal")
        .is("owner_id", null)
        .is("assigned_to", null)
        .order("created_at", { ascending: false }),
      // For naming the plan on fulfilled rows.
      supabase
        .from("meal_plans")
        .select("id, name, goal")
        .is("owner_id", null)
        .not("assigned_to", "is", null),
    ]);

  const requests = (requestData ?? []) as PlanRequest[];
  const pending = requests.filter((r) => r.status === "pending");
  const resolved = requests.filter((r) => r.status !== "pending").slice(0, 20);
  const assignable = (planData ?? []) as AssignablePlan[];
  const planNames = new Map(
    ((assignedPlanData ?? []) as AssignablePlan[]).map((p) => [p.id, p.name])
  );

  return (
    <div className="space-y-8">
      {error && (
        <p className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/[0.08] px-3.5 py-3 text-sm text-danger">
          <WarningCircle className="mt-0.5 size-4 shrink-0" weight="bold" />
          {error}
        </p>
      )}

      <section>
        <h2 className="mb-1 font-display text-lg font-semibold tracking-tight text-paper">
          Open requests{" "}
          <span className="font-mono text-sm text-paper-mute tabular">({pending.length})</span>
        </h2>
        <p className="mb-4 text-xs text-paper-mute">
          Assigning a plan makes it private to that user and shows it under &ldquo;From your
          coach&rdquo; on their Meal plans tab. Need a fresh one? Build it in{" "}
          <Link href="/admin/plans" className="text-lime underline underline-offset-4">
            Meal plans
          </Link>{" "}
          first, then assign it here.
        </p>

        {pending.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-ink-700 px-6 py-14 text-center text-sm text-paper-mute">
            No open requests — users can ask for a plan from their Meal plans tab.
          </p>
        ) : (
          <ul className="space-y-4">
            {pending.map((request) => (
              <li
                key={request.id}
                className="rounded-2xl border border-ink-800 bg-ink-900/60 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-display text-sm font-semibold text-paper">
                      {request.full_name || request.email || "Unknown user"}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-paper-mute">
                      {request.email}
                      {request.goal && ` · ${GOALS[request.goal].label}`}
                      {` · ${requestDate(request.created_at)}`}
                    </p>
                  </div>
                  <form action={dismissPlanRequest}>
                    <input type="hidden" name="id" value={request.id} />
                    <button
                      type="submit"
                      className="btn-press rounded-lg border border-ink-700 px-3 py-1.5 text-xs font-semibold text-paper-dim transition-colors hover:border-danger/50 hover:text-danger"
                    >
                      Dismiss
                    </button>
                  </form>
                </div>

                {request.note && (
                  <p className="mt-3 rounded-lg bg-ink-800/60 px-3.5 py-2.5 text-xs leading-relaxed text-paper-dim">
                    {request.note}
                  </p>
                )}

                <form
                  action={assignPlanToRequest}
                  className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center"
                >
                  <input type="hidden" name="request_id" value={request.id} />
                  <select
                    name="plan_id"
                    required
                    defaultValue=""
                    aria-label="Plan to assign"
                    className="field sm:flex-1"
                  >
                    <option value="" disabled>
                      {assignable.length === 0
                        ? "No unassigned plans — build one first"
                        : "Pick a plan to assign…"}
                    </option>
                    {assignable.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} · {GOALS[plan.goal].label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={assignable.length === 0}
                    className="btn-press rounded-xl bg-lime px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wide text-lime-ink hover:bg-lime-deep disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Assign
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      {resolved.length > 0 && (
        <section>
          <h2 className="mb-4 font-display text-lg font-semibold tracking-tight text-paper">
            Recently resolved
          </h2>
          <ul className="space-y-2">
            {resolved.map((request) => (
              <li
                key={request.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-800 bg-ink-900/40 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-paper">
                    {request.full_name || request.email || "Unknown user"}
                    <span className="ml-2 text-xs text-paper-mute">
                      {request.status === "fulfilled"
                        ? request.plan_id
                          ? `got “${planNames.get(request.plan_id) ?? "a plan"}”`
                          : "fulfilled (plan since deleted)"
                        : "dismissed"}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-paper-mute">
                    {request.resolved_at ? requestDate(request.resolved_at) : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {request.status === "fulfilled" && request.plan_id && (
                    <Link
                      href={`/admin/plans/${request.plan_id}`}
                      className="btn-press inline-flex items-center gap-1.5 rounded-lg border border-ink-700 px-3 py-1.5 text-xs font-semibold text-paper-dim transition-colors hover:border-lime/50 hover:text-lime"
                    >
                      <ArrowSquareOut weight="bold" className="size-3.5" />
                      Plan
                    </Link>
                  )}
                  {request.status === "fulfilled" && (
                    <form action={unassignPlanRequest}>
                      <input type="hidden" name="id" value={request.id} />
                      <button
                        type="submit"
                        className="btn-press rounded-lg border border-ink-700 px-3 py-1.5 text-xs font-semibold text-paper-dim transition-colors hover:border-danger/50 hover:text-danger"
                      >
                        Unassign
                      </button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
