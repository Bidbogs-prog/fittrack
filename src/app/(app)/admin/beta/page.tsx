import { requireAdmin } from "@/lib/auth";
import { SITE_URL } from "@/lib/site";
import { admitWaitlist, createInviteCode } from "./actions";

export const metadata = { title: "Admin · Beta" };

interface WaitRow {
  email: string;
  city: string | null;
  phone_os: string | null;
  health_app: string | null;
  referral_code: string;
  referred_by: string | null;
  source: Record<string, string> | null;
  status: "waiting" | "admitted" | "joined";
  admitted_at: string | null;
  created_at: string;
}

interface CodeRow {
  code: string;
  label: string | null;
  max_uses: number;
  uses: number;
  premium_days: number;
  expires_at: string | null;
  created_at: string;
}

const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—";

const field = "field h-10 text-sm";

export default async function AdminBetaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string; admitted?: string; s?: string }>;
}) {
  const [{ supabase }, q] = await Promise.all([requireAdmin(), searchParams]);
  const [{ data: waitData }, { data: codeData }, { count: accessCount }] = await Promise.all([
    supabase.from("waitlist").select("*").order("created_at").limit(2000),
    supabase.from("invite_codes").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("beta_access").select("user_id", { count: "exact", head: true }),
  ]);
  const rows = (waitData ?? []) as WaitRow[];
  const codes = (codeData ?? []) as CodeRow[];

  const refs = new Map<string, number>();
  for (const r of rows) if (r.referred_by) refs.set(r.referred_by, (refs.get(r.referred_by) ?? 0) + 1);
  const count = (s: WaitRow["status"]) => rows.filter((r) => r.status === s).length;
  const queue = rows
    .filter((r) => r.status === "waiting")
    .sort((a, b) => (refs.get(b.referral_code) ?? 0) - (refs.get(a.referral_code) ?? 0) || a.created_at.localeCompare(b.created_at));
  const admitted = rows.filter((r) => r.status === "admitted");
  const filter = q.s === "admitted" || q.s === "joined" ? q.s : "waiting";
  const shown = filter === "waiting" ? queue : rows.filter((r) => r.status === filter).reverse();
  const os = (o: string) => rows.filter((r) => r.phone_os === o).length;

  return (
    <div className="space-y-8">
      {q.error && <p role="alert" className="rounded-xl border border-danger/30 bg-danger/[0.08] px-3.5 py-3 text-sm text-danger">{q.error}</p>}
      {q.created && <p role="status" className="rounded-xl border border-fibre/30 bg-fibre/10 px-3.5 py-3 text-sm text-fibre">Created {q.created}.</p>}
      {q.admitted && <p role="status" className="rounded-xl border border-fibre/30 bg-fibre/10 px-3.5 py-3 text-sm text-fibre">Admitted {q.admitted}. Send them the email list below — they get in automatically when they sign up with that address.</p>}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ["Waiting", count("waiting")],
          ["Admitted", count("admitted")],
          ["Joined", count("joined")],
          ["Beta accounts", accessCount ?? 0],
          ["iPhone / Android", `${os("ios")} / ${os("android")}`],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-ink-800 bg-ink-900 p-4">
            <p className="text-xs text-paper-mute">{label}</p>
            <p className="mt-1 font-mono text-2xl font-semibold text-paper tabular">{value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <form action={admitWaitlist} className="flex flex-col gap-3 rounded-2xl border border-ink-800 bg-ink-900 p-4">
          <h2 className="font-display text-lg font-semibold text-paper">Admit next batch</h2>
          <p className="text-sm text-paper-dim">Queue order: most referrals first, then earliest. Admitted emails get in on signup, with 90 days of founding-member Premium. Batch size is your AI cost control.</p>
          <div className="flex gap-2">
            <input name="count" type="number" min={1} max={1000} defaultValue={50} className={`${field} w-28`} aria-label="How many" />
            <button type="submit" className="btn-press btn-flame rounded-xl px-4 text-sm font-semibold">Admit</button>
          </div>
          {admitted.length > 0 && (
            <label className="space-y-1.5">
              <span className="text-xs text-paper-mute">Admitted, not signed up yet ({admitted.length}) — copy into your email tool</span>
              <textarea readOnly rows={3} className="field font-mono text-xs" value={admitted.map((r) => r.email).join(", ")} />
            </label>
          )}
        </form>

        <form action={createInviteCode} className="flex flex-col gap-3 rounded-2xl border border-ink-800 bg-ink-900 p-4">
          <h2 className="font-display text-lg font-semibold text-paper">New invite code</h2>
          <div className="grid grid-cols-2 gap-2">
            <input name="code" placeholder="Code (blank = random)" className={`${field} uppercase`} />
            <input name="label" placeholder="Label, e.g. @creator / Gym X" className={field} />
            <label className="text-xs text-paper-mute">Max uses<input name="max_uses" type="number" min={1} defaultValue={1} className={field} /></label>
            <label className="text-xs text-paper-mute">Premium days<input name="premium_days" type="number" min={0} defaultValue={90} className={field} /></label>
            <label className="text-xs text-paper-mute">Expires in days (0 = never)<input name="expires_days" type="number" min={0} defaultValue={0} className={field} /></label>
          </div>
          <button type="submit" className="btn-press btn-flame self-start rounded-xl px-4 py-2 text-sm font-semibold">Create code</button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-paper">Invite codes</h2>
        <div className="overflow-x-auto rounded-2xl border border-ink-800">
          <table className="w-full text-sm">
            <thead className="bg-ink-900 text-start text-xs text-paper-mute">
              <tr>{["Code", "Label", "Uses", "Premium", "Expires", "Share link"].map((h) => <th key={h} className="px-3 py-2 text-start font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {codes.length === 0 && <tr><td colSpan={6} className="px-3 py-4 text-paper-mute">No codes yet.</td></tr>}
              {codes.map((c) => (
                <tr key={c.code} className="border-t border-ink-800">
                  <td className="px-3 py-2 font-mono text-paper">{c.code}</td>
                  <td className="px-3 py-2 text-paper-dim">{c.label ?? "—"}</td>
                  <td className="px-3 py-2 font-mono tabular">{c.uses} / {c.max_uses}</td>
                  <td className="px-3 py-2 font-mono tabular">{c.premium_days} d</td>
                  <td className="px-3 py-2">{day(c.expires_at)}</td>
                  <td className="px-3 py-2 font-mono text-xs text-paper-mute">{SITE_URL}/signup?code={c.code}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-4">
          <h2 className="font-display text-lg font-semibold text-paper">Waitlist</h2>
          {(["waiting", "admitted", "joined"] as const).map((s) => (
            <a key={s} href={`/admin/beta?s=${s}`} className={`text-sm ${filter === s ? "font-semibold text-flame" : "text-paper-mute hover:text-paper"}`}>
              {s} ({count(s)})
            </a>
          ))}
        </div>
        <div className="overflow-x-auto rounded-2xl border border-ink-800">
          <table className="w-full text-sm">
            <thead className="bg-ink-900 text-xs text-paper-mute">
              <tr>{["#", "Email", "City", "Phone", "Health app", "Refs", "Source", "Joined list"].map((h) => <th key={h} className="px-3 py-2 text-start font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {shown.slice(0, 500).map((r, i) => (
                <tr key={r.email} className="border-t border-ink-800">
                  <td className="px-3 py-2 font-mono text-paper-mute tabular">{filter === "waiting" ? i + 1 : ""}</td>
                  <td className="px-3 py-2 text-paper">{r.email}</td>
                  <td className="px-3 py-2 text-paper-dim">{r.city ?? "—"}</td>
                  <td className="px-3 py-2 text-paper-dim">{r.phone_os ?? "—"}</td>
                  <td className="px-3 py-2 text-paper-dim">{r.health_app ?? "—"}</td>
                  <td className="px-3 py-2 font-mono tabular">{refs.get(r.referral_code) ?? 0}</td>
                  <td className="px-3 py-2 text-xs text-paper-mute">{r.source?.utm_source ?? r.source?.referrer ?? (r.referred_by ? `ref ${r.referred_by}` : "—")}</td>
                  <td className="px-3 py-2">{day(r.created_at)}</td>
                </tr>
              ))}
              {shown.length === 0 && <tr><td colSpan={8} className="px-3 py-4 text-paper-mute">Nobody here yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
