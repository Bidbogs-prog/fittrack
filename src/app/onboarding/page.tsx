import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
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
  const [{ profile }, { error, edit }] = await Promise.all([getProfile(), searchParams]);

  const editing = edit === "1" && profile.onboarded;
  if (profile.onboarded && !editing) redirect("/dashboard");

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[radial-gradient(800px_500px_at_85%_30%,rgba(255,157,59,0.09),transparent_60%)]">
      <StatusMessage error={error} className="mx-auto mt-4 w-[calc(100%-3rem)] max-w-[1112px]" />
      <OnboardingForm profile={editing ? profile : null} />
    </div>
  );
}
