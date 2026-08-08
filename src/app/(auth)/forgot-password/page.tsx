import Link from "next/link";
import { WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { Reveal } from "@/components/motion/reveal";
import { forgotPassword } from "../actions";

export const metadata = { title: "Reset password" };

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <Reveal className="w-full max-w-sm" onScroll={false} stagger={0.06} y={16}>
      <h1 data-reveal className="font-display text-3xl font-bold tracking-tight text-paper">
        Forgot your password?
      </h1>
      <p data-reveal className="mt-2 text-sm text-paper-mute">
        Enter your email and we&rsquo;ll send a link to set a new one.
      </p>

      {error && (
        <p
          data-reveal
          className="mt-5 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/[0.08] px-3.5 py-3 text-sm text-danger"
        >
          <WarningCircle className="mt-0.5 size-4 shrink-0" weight="bold" />
          <span className="min-w-0 break-words">{error}</span>
        </p>
      )}

      <form action={forgotPassword} className="mt-7 space-y-5">
        <div data-reveal className="space-y-2">
          <label htmlFor="email" className="field-label">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="field"
            placeholder="you@example.com"
          />
        </div>
        <button
          data-reveal
          type="submit"
          className="btn-press w-full rounded-xl bg-lime px-5 py-3 font-display text-sm font-bold uppercase tracking-wide text-lime-ink transition-colors hover:bg-lime-deep"
        >
          Send reset link
        </button>
      </form>

      <p data-reveal className="mt-6 text-sm text-paper-mute">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-paper underline-offset-4 hover:underline">
          Back to log in
        </Link>
      </p>
    </Reveal>
  );
}
