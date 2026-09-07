import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/logo";
import { Reveal } from "@/components/motion/reveal";
import { StatusMessage } from "@/components/status-message";
import { getProfile } from "@/lib/auth";
import { OnboardingForm } from "./onboarding-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return { title: t("onboarding") };
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; edit?: string }>;
}) {
  const [{ profile }, { error, edit }, t] = await Promise.all([
    getProfile(),
    searchParams,
    getTranslations("onboarding"),
  ]);

  const editing = edit === "1" && profile.onboarded;
  if (profile.onboarded && !editing) redirect("/dashboard");

  return (
    // overflow-x-clip (not overflow-hidden) keeps the blur blob contained
    // without creating a scroll container that defeats lg:sticky.
    <div className="blueprint relative min-h-[100dvh] overflow-x-clip">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 size-[560px] -translate-x-1/2 rounded-full bg-flame/[0.06] blur-[110px]"
      />
      <header className="relative z-10 mx-auto w-full max-w-[1100px] px-6 py-6">
        <Logo href="/onboarding" />
      </header>
      <main className="relative z-10 mx-auto w-full max-w-[1100px] px-6 pb-24">
        <Reveal onScroll={false} stagger={0.08} y={18}>
          <p data-reveal className="text-xs font-semibold uppercase tracking-[0.16em] text-flame">
            {editing ? t("eyebrowEditing") : t("eyebrow")}
          </p>
          <h1 data-reveal className="mt-3 max-w-[24ch] font-display text-3xl font-bold leading-tight tracking-tighter text-paper sm:text-4xl md:text-5xl">
            {editing ? t("titleEditing") : t("title")}
          </h1>
          <p data-reveal className="mt-3 max-w-[58ch] text-sm leading-relaxed text-paper-dim">
            {t("intro")}
          </p>
        </Reveal>

        <StatusMessage error={error} className="mt-6 max-w-lg" />

        <OnboardingForm profile={editing ? profile : null} />
      </main>
    </div>
  );
}
