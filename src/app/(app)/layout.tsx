import { SignOut } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/logo";
import { RouteFx } from "@/components/motion/route-fx";
import { MainFrame, MobileTabs, SideNav } from "@/components/nav";
import { getProfile } from "@/lib/auth";
import { ensureBetaAccess, getBetaInfo } from "@/lib/beta";
import { isPremium } from "@/lib/entitlements";
import { IdentifyUser } from "@/components/identify-user";
import { signout } from "../(auth)/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [{ supabase, userId, profile }, t] = await Promise.all([getProfile(), getTranslations("shell")]);

  if (!(await ensureBetaAccess(supabase, userId))) redirect("/invite");
  if (!profile.onboarded) redirect("/onboarding");
  const [beta, premium] = await Promise.all([getBetaInfo(supabase, userId), isPremium(supabase, userId)]);

  const firstName = profile.full_name?.split(" ")[0] ?? t("athlete");
  const initial = (profile.full_name ?? profile.email ?? "?").trim().charAt(0).toUpperCase();

  return (
    // Desktop: 232px sidebar | content. Today/Coach split the content into
    // centre + 320px rail themselves; other pages span it.
    <div className="flex min-h-[100dvh] w-full flex-col lg:flex-row">
      <aside className="flex flex-col border-ink-800 bg-ink-950 max-lg:hidden lg:sticky lg:top-0 lg:h-[100dvh] lg:w-[232px] lg:shrink-0 lg:border-e lg:px-4 lg:py-[22px]">
        <div className="mx-1.5 mb-[26px]">
          <Logo href="/dashboard" />
        </div>
        <SideNav />
        <div className="mt-auto border-t border-ink-800 px-1.5 pt-3.5 text-[13px] leading-relaxed">
          <p className="truncate font-medium text-paper">{firstName}</p>
          <p className="truncate text-xs text-paper-mute">{profile.email}</p>
          <p className="mt-1 flex flex-wrap gap-x-1.5 text-xs text-paper-mute">
            <a href="/onboarding?edit=1" className="inline-flex min-h-8 items-center hover:text-flame">
              {t("updateStats")}
            </a>
            <span aria-hidden className="inline-flex items-center">·</span>
            <Link href="/account" className="inline-flex min-h-8 items-center hover:text-flame">
              {t("settings")}
            </Link>
          </p>
          <form action={signout}>
            <button
              type="submit"
              className="btn-press inline-flex min-h-8 items-center gap-1.5 text-xs text-paper-mute hover:text-danger"
            >
              <SignOut className="size-3.5" />
              {t("signOut")}
            </button>
          </form>
        </div>
      </aside>

      {/* mobile header + segmented tabs */}
      <header className="lg:hidden">
        <div className="flex items-center justify-between px-[18px] pt-1.5 pb-2.5">
          <Logo href="/dashboard" size="sm" />
          <Link
            href="/account"
            aria-label={t("me")}
            className="grid size-11 place-items-center rounded-full"
          >
            <span className="grid size-8 place-items-center rounded-full bg-ink-700 font-display text-[13px] font-semibold text-paper-dim">
              {initial}
            </span>
          </Link>
        </div>
        <MobileTabs />
      </header>

      <IdentifyUser
        userId={userId}
        props={{
          premium,
          beta_via: beta.via ?? "unknown",
          ...(beta.inviteCode ? { invite_code: beta.inviteCode } : {}),
          ...Object.fromEntries(Object.entries(beta.source ?? {}).map(([k, v]) => [`src_${k}`, v])),
        }}
      />
      <MainFrame>
        <RouteFx>{children}</RouteFx>
      </MainFrame>
    </div>
  );
}
