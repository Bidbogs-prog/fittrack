import { Info, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { getProfile } from "@/lib/auth";
import { changePassword, deleteAccount, saveFastingWindow } from "./actions";

export const metadata = { title: "Account" };

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const [{ profile }, { error, message }] = await Promise.all([getProfile(), searchParams]);

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-lime">
          {profile.email}
        </p>
        <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tighter text-paper md:text-4xl">
          Account
        </h1>
      </header>

      {message && (
        <p className="flex max-w-xl items-start gap-2 rounded-lg border border-lime/25 bg-lime/[0.06] px-3.5 py-3 text-sm text-lime">
          <Info className="mt-0.5 size-4 shrink-0" weight="bold" />
          <span className="min-w-0 break-words">{message}</span>
        </p>
      )}
      {error && (
        <p className="flex max-w-xl items-start gap-2 rounded-lg border border-danger/30 bg-danger/[0.08] px-3.5 py-3 text-sm text-danger">
          <WarningCircle className="mt-0.5 size-4 shrink-0" weight="bold" />
          <span className="min-w-0 break-words">{error}</span>
        </p>
      )}

      <section className="max-w-xl rounded-2xl border border-ink-800 bg-ink-900/60 p-5 lg:p-6">
        <h2 className="font-display text-base font-semibold text-paper">Change password</h2>
        <form action={changePassword} className="mt-4 space-y-4">
          <div className="space-y-2">
            <label htmlFor="password" className="field-label">New password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              className="field"
              placeholder="At least 8 characters"
            />
          </div>
          <button
            type="submit"
            className="btn-press rounded-xl bg-lime px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wide text-lime-ink hover:bg-lime-deep"
          >
            Update password
          </button>
        </form>
      </section>

      <section className="max-w-xl rounded-2xl border border-ink-800 bg-ink-900/60 p-5 lg:p-6">
        <h2 className="font-display text-base font-semibold text-paper">Intermittent fasting</h2>
        <p className="mt-2 text-sm text-paper-dim">
          Optional: set your daily eating window and the dashboard shows whether it&rsquo;s open.
          A window past midnight (e.g. 20:00 to 04:00) works too. Clear both fields to disable.
        </p>
        <form action={saveFastingWindow} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label htmlFor="fasting-start" className="field-label">First meal</label>
              <input
                id="fasting-start"
                name="start"
                type="time"
                defaultValue={profile.eating_window_start?.slice(0, 5) ?? ""}
                className="field tabular"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="fasting-end" className="field-label">Last meal</label>
              <input
                id="fasting-end"
                name="end"
                type="time"
                defaultValue={profile.eating_window_end?.slice(0, 5) ?? ""}
                className="field tabular"
              />
            </div>
          </div>
          <button
            type="submit"
            className="btn-press rounded-xl bg-lime px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wide text-lime-ink hover:bg-lime-deep"
          >
            Save window
          </button>
        </form>
      </section>

      <section className="max-w-xl rounded-2xl border border-danger/30 bg-danger/[0.04] p-5 lg:p-6">
        <h2 className="font-display text-base font-semibold text-danger">Delete account</h2>
        <p className="mt-2 text-sm text-paper-dim">
          Permanently removes your account and everything in it — profile, diary,
          weight history, favorites, recipes and foods you created. There is no undo.
        </p>
        <form action={deleteAccount} className="mt-4 space-y-4">
          <div className="space-y-2">
            <label htmlFor="confirm" className="field-label">
              Type <span className="font-mono text-danger">delete</span> to confirm
            </label>
            <input
              id="confirm"
              name="confirm"
              autoComplete="off"
              required
              className="field"
              placeholder="delete"
            />
          </div>
          <button
            type="submit"
            className="btn-press rounded-xl border border-danger/50 px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wide text-danger transition-colors hover:bg-danger/10"
          >
            Delete my account
          </button>
        </form>
      </section>
    </div>
  );
}
