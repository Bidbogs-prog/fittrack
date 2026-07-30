import { SignOut } from "@phosphor-icons/react/dist/ssr";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { RouteFx } from "@/components/motion/route-fx";
import { AppNav } from "@/components/nav";
import { getProfile, isAdmin } from "@/lib/auth";
import { signout } from "../(auth)/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, userId, profile } = await getProfile();

  if (!profile.onboarded) redirect("/onboarding");

  const admin = await isAdmin(supabase, userId);
  const firstName = profile.full_name?.split(" ")[0] ?? "athlete";

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[1400px] flex-col md:flex-row">
      {/* sidebar */}
      <aside className="flex flex-col gap-8 border-ink-800 px-5 py-6 max-md:border-b md:sticky md:top-0 md:h-[100dvh] md:w-60 md:shrink-0 md:border-r">
        <Logo href="/dashboard" />
        <div className="max-md:hidden md:flex md:flex-1 md:flex-col md:justify-between">
          <AppNav admin={admin} />
          <div className="border-t border-ink-800 pt-4">
            <p className="truncate text-sm font-medium text-paper">{firstName}</p>
            <p className="truncate text-xs text-paper-mute">{profile.email}</p>
            <a
              href="/onboarding?edit=1"
              className="mt-2 block text-xs font-medium text-paper-mute underline-offset-4 hover:text-lime hover:underline"
            >
              Update body stats
            </a>
            <form action={signout} className="mt-3">
              <button
                type="submit"
                className="btn-press flex items-center gap-2 text-xs font-medium text-paper-mute hover:text-danger"
              >
                <SignOut className="size-4" />
                Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* mobile nav */}
      <div className="sticky bottom-0 z-30 order-last border-t border-ink-800 bg-ink-950/95 px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden">
        <AppNav admin={admin} />
      </div>

      <main className="min-w-0 flex-1 px-5 py-8 md:px-10 md:py-10">
        <RouteFx>{children}</RouteFx>
      </main>
    </div>
  );
}
