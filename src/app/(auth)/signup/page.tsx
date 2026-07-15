import Link from "next/link";
import { WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { Reveal } from "@/components/motion/reveal";
import { signup } from "../actions";
import { OAuthButtons } from "../oauth-buttons";

export const metadata = { title: "Create account" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <Reveal className="w-full max-w-sm" onScroll={false} stagger={0.06} y={16}>
      <h1 data-reveal className="font-display text-3xl font-bold tracking-tight text-paper">Create your account</h1>
      <p data-reveal className="mt-2 text-sm text-paper-mute">
        Two minutes of setup, then your targets are ready.
      </p>

      {error && (
        <p data-reveal className="mt-5 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/[0.08] px-3.5 py-3 text-sm text-danger">
          <WarningCircle className="mt-0.5 size-4 shrink-0" weight="bold" />
          {error}
        </p>
      )}

      <form action={signup} className="mt-7 space-y-5">
        <div data-reveal className="space-y-2">
          <label htmlFor="full_name" className="field-label">Name</label>
          <input id="full_name" name="full_name" type="text" autoComplete="name" required className="field" placeholder="Alex Carter" />
        </div>
        <div data-reveal className="space-y-2">
          <label htmlFor="email" className="field-label">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required className="field" placeholder="you@example.com" />
        </div>
        <div data-reveal className="space-y-2">
          <label htmlFor="password" className="field-label">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="field"
            placeholder="At least 8 characters"
          />
          <p className="text-xs text-paper-mute">Use 8+ characters.</p>
        </div>
        <button
          data-reveal
          type="submit"
          className="btn-press w-full rounded-xl bg-lime px-5 py-3 font-display text-sm font-bold uppercase tracking-wide text-lime-ink transition-colors hover:bg-lime-deep"
        >
          Create account
        </button>
      </form>

      <div data-reveal>
        <OAuthButtons />
      </div>

      <p data-reveal className="mt-6 text-sm text-paper-mute">
        Already tracking?{" "}
        <Link href="/login" className="font-medium text-paper underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </Reveal>
  );
}
