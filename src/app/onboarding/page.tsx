import { WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { Reveal } from "@/components/motion/reveal";
import { getProfile } from "@/lib/auth";
import { OnboardingForm } from "./onboarding-form";

export const metadata = { title: "Set up your targets" };

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; edit?: string }>;
}) {
  const [{ profile }, { error, edit }] = await Promise.all([getProfile(), searchParams]);

  const editing = edit === "1" && profile.onboarded;
  if (profile.onboarded && !editing) redirect("/dashboard");

  return (
    // overflow-x-clip (not overflow-hidden) keeps the blur blob contained
    // without creating a scroll container that defeats lg:sticky.
    <div className="blueprint relative min-h-[100dvh] overflow-x-clip">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 size-[560px] -translate-x-1/2 rounded-full bg-lime/[0.06] blur-[110px]"
      />
      <header className="relative z-10 mx-auto w-full max-w-[1100px] px-6 py-6">
        <Logo href="/onboarding" />
      </header>
      <main className="relative z-10 mx-auto w-full max-w-[1100px] px-6 pb-24">
        <Reveal onScroll={false} stagger={0.08} y={18}>
          <p data-reveal className="text-xs font-semibold uppercase tracking-[0.16em] text-lime">
            {editing ? "Update your stats" : "Step 1 of 1 — your engine"}
          </p>
          <h1 data-reveal className="mt-3 max-w-[24ch] font-display text-3xl font-bold leading-tight tracking-tighter text-paper sm:text-4xl md:text-5xl">
            {editing
              ? "Body changed? Targets should too."
              : "Tell us about your body. We'll do the math."}
          </h1>
          <p data-reveal className="mt-3 max-w-[58ch] text-sm leading-relaxed text-paper-dim">
            These numbers feed the Mifflin-St Jeor equation for your BMR, then your training
            frequency sets the multiplier for TDEE. Your daily calorie and macro targets update
            live as you type.
          </p>
        </Reveal>

        {error && (
          <p className="mt-6 flex max-w-lg items-start gap-2 rounded-lg border border-danger/30 bg-danger/[0.08] px-3.5 py-3 text-sm text-danger">
            <WarningCircle className="mt-0.5 size-4 shrink-0" weight="bold" />
            <span className="min-w-0 break-words">{error}</span>
          </p>
        )}

        <OnboardingForm profile={editing ? profile : null} />
      </main>
    </div>
  );
}
