import { SignOut } from "@phosphor-icons/react/dist/ssr";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { RouteFx } from "@/components/motion/route-fx";
import { AppNav } from "@/components/nav";
import { getProfile } from "@/lib/auth";
import { signout } from "../(auth)/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await getProfile();

  if (!profile.onboarded) redirect("/onboarding");

  const firstName = profile.full_name?.split(" ")[0] ?? "athlete";

  return (
    // Full-width shell: the sidebar pins to the viewport edge; only the
    // content column is capped and centered (see <main> below).
    <div className="flex min-h-[100dvh] w-full flex-col md:flex-row">
      {/* sidebar */}
      <aside className="flex flex-col gap-8 border-ink-800 px-5 py-6 max-md:border-b md:sticky md:top-0 md:h-[100dvh] md:w-60 md:shrink-0 md:border-r">
        <Logo href="/dashboard" />
        <div className="max-md:hidden md:flex md:flex-1 md:flex-col md:justify-between">
          <AppNav />
          <div className="border-t border-ink-800 pt-4">
            <p className="truncate text-sm font-medium text-paper">{firstName}</p>
            <p className="truncate text-xs text-paper-mute">{profile.email}</p>
            <a
              href="/onboarding?edit=1"
              className="mt-1 flex min-h-10 items-center text-xs font-medium text-paper-mute underline-offset-4 hover:text-lime hover:underline"
            >
              Update body stats
            </a>
            <a
              href="/account"
              className="flex min-h-10 items-center text-xs font-medium text-paper-mute underline-offset-4 hover:text-lime hover:underline"
            >
              Account settings
            </a>
            <form action={signout} className="mt-1">
              <button
                type="submit"
                className="btn-press flex min-h-10 items-center gap-2 text-xs font-medium text-paper-mute hover:text-danger"
              >
                <SignOut className="size-4" />
                Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* mobile nav — includes Account, since the sidebar's user block is
          desktop-only and /account carries those actions on mobile */}
      <div className="sticky bottom-0 z-30 order-last border-t border-ink-800 bg-ink-950/95 px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden">
        <AppNav account />
      </div>

      {/* Stage the gutter: at md the 240px sidebar already claims a third of
          a tablet-portrait viewport — don't double the padding on top of it. */}
      <main className="min-w-0 flex-1 px-5 py-8 md:px-6 md:py-10 lg:px-10">
        <div className="mx-auto w-full max-w-[1100px]">
          <RouteFx>{children}</RouteFx>
        </div>
      </main>
    </div>
  );
}
