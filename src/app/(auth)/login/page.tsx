import Link from "next/link";
import { Info, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { login } from "../actions";
import { OAuthButtons } from "../oauth-buttons";

export const metadata = { title: "Log in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string; next?: string }>;
}) {
  const { error, message, next } = await searchParams;

  return (
    <div className="reveal w-full max-w-sm">
      <h1 className="font-display text-3xl font-bold tracking-tight text-paper">Welcome back</h1>
      <p className="mt-2 text-sm text-paper-mute">Log in to keep your streak alive.</p>

      {message && (
        <p className="mt-5 flex items-start gap-2 rounded-lg border border-lime/25 bg-lime/[0.06] px-3.5 py-3 text-sm text-lime">
          <Info className="mt-0.5 size-4 shrink-0" weight="bold" />
          {message}
        </p>
      )}
      {error && (
        <p className="mt-5 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/[0.08] px-3.5 py-3 text-sm text-danger">
          <WarningCircle className="mt-0.5 size-4 shrink-0" weight="bold" />
          {error}
        </p>
      )}

      <form action={login} className="mt-7 space-y-5">
        {next && <input type="hidden" name="next" value={next} />}
        <div className="space-y-2">
          <label htmlFor="email" className="field-label">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required className="field" placeholder="you@example.com" />
        </div>
        <div className="space-y-2">
          <label htmlFor="password" className="field-label">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required className="field" placeholder="••••••••" />
        </div>
        <button
          type="submit"
          className="btn-press w-full rounded-xl bg-lime px-5 py-3 font-display text-sm font-bold uppercase tracking-wide text-lime-ink hover:bg-lime-deep"
        >
          Log in
        </button>
      </form>

      <OAuthButtons next={next} />

      <p className="mt-6 text-sm text-paper-mute">
        New here?{" "}
        <Link href="/signup" className="font-medium text-paper underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
