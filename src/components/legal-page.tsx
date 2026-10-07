import Link from "next/link";
import { ConsentReset } from "@/components/consent-banner";
import { Logo } from "@/components/logo";
import { LEGAL_UPDATED } from "@/lib/site";

/**
 * Shell for the legal pages. The text is English-only on purpose: it is a
 * draft pending professional review, and translating it before review would
 * only multiply the copies to correct.
 */
export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-[100dvh] max-w-2xl px-6 pt-8 pb-16" lang="en" dir="ltr">
      <Logo href="/" size="sm" />
      <h1 className="mt-10 font-display text-3xl font-bold tracking-tight text-paper lg:text-4xl">{title}</h1>
      <p className="mt-2 text-xs text-paper-mute">Last updated {LEGAL_UPDATED}</p>
      <div className="legal mt-8 space-y-4 text-sm leading-relaxed text-paper-dim [&_a]:text-flame [&_a]:underline [&_a]:underline-offset-2 [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-paper [&_li]:ms-5 [&_li]:list-disc [&_strong]:text-paper">
        {children}
      </div>
      <nav className="mt-12 flex gap-4 border-t border-ink-800 pt-5 text-xs text-paper-mute">
        <Link href="/privacy" className="hover:text-paper">Privacy</Link>
        <Link href="/terms" className="hover:text-paper">Terms</Link>
        <Link href="/refunds" className="hover:text-paper">Refunds</Link>
        <ConsentReset />
      </nav>
    </div>
  );
}
