import { ShieldStar } from "@phosphor-icons/react/dist/ssr";
import { requireAdmin } from "@/lib/auth";
import { AdminTabs } from "./tabs";

export const metadata = { title: "Admin" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin(); // redirects non-admins; actions re-verify separately

  return (
    <div className="space-y-7">
      <header>
        <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-lime">
          <ShieldStar weight="fill" className="size-4" />
          Coach console
        </p>
        <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tighter text-paper md:text-4xl">
          Admin
        </h1>
        <p className="mt-2 max-w-[60ch] text-sm text-paper-dim">
          Curate the food library and assemble meal plans. Everything you add here becomes
          instantly available to every athlete.
        </p>
      </header>
      <AdminTabs />
      {children}
    </div>
  );
}
