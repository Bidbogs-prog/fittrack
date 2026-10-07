"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GoogleLogo } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { useClientValue } from "@/lib/use-client-clock";

/** Minimal typing for Google Identity Services. */
interface GoogleId {
  initialize(config: {
    client_id: string;
    callback: (res: { credential?: string }) => void;
    nonce: string;
    use_fedcm_for_prompt?: boolean;
    itp_support?: boolean;
    context?: "signin" | "signup" | "use";
  }): void;
  renderButton(el: HTMLElement, options: Record<string, string | number>): void;
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

/**
 * Google only accepts origins registered on the OAuth client ("Authorized
 * JavaScript origins"). Vercel gives every deploy its own URL, so the Google
 * button is used only on the canonical site (NEXT_PUBLIC_SITE_URL), extra
 * origins in NEXT_PUBLIC_GOOGLE_ORIGINS (comma-separated) and localhost;
 * anywhere else the redirect flow takes over instead of "no registered origin".
 */
function originAllowed(): boolean {
  const here = window.location.origin;
  if (/^http:\/\/localhost(:\d+)?$/.test(here)) return true;
  const allowed = [process.env.NEXT_PUBLIC_SITE_URL, ...(process.env.NEXT_PUBLIC_GOOGLE_ORIGINS ?? "").split(",")]
    .map((o) => o?.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  return allowed.includes(here);
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const safeNext = (next: string | undefined) =>
  next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/dashboard";

/**
 * Google sign-in without the Supabase redirect: Google Identity Services runs
 * on our own origin (so Google's prompt names this site, not
 * *.supabase.co) and returns an ID token that Supabase verifies via
 * signInWithIdToken. Falls back to the redirect flow (`fallback`) when the
 * client id isn't configured or Google's script fails to load.
 */
export function GoogleSignIn({
  next,
  locale,
  context,
  failedLabel,
  label,
  fallback,
}: {
  next?: string;
  locale: string;
  context: "signin" | "signup";
  failedLabel: string;
  /** Text of our styled button, matching the redirect-flow button. */
  label: string;
  fallback: React.ReactNode;
}) {
  const router = useRouter();
  const slot = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [broken, setBroken] = useState(!CLIENT_ID);
  const usable = useClientValue(() => !!CLIENT_ID && originAllowed(), false);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready || !usable || !CLIENT_ID || !slot.current || !window.google) return;
    let cancelled = false;
    const nonce = crypto.randomUUID();
    void sha256Hex(nonce).then((hashed) => {
      if (cancelled || !slot.current || !window.google) return;
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        nonce: hashed,
        context,
        use_fedcm_for_prompt: true,
        itp_support: true,
        callback: async ({ credential }) => {
          if (!credential) return setError(true);
          setBusy(true);
          setError(false);
          const { error: signInError } = await createClient().auth.signInWithIdToken({
            provider: "google",
            token: credential,
            nonce,
          });
          if (signInError) {
            console.error("[google] signInWithIdToken failed", signInError.message);
            setBusy(false);
            setError(true);
            return;
          }
          router.replace(safeNext(next));
          router.refresh();
        },
      });
      window.google.accounts.id.renderButton(slot.current, {
        type: "standard",
        theme: "filled_black",
        size: "large",
        shape: "rectangular",
        // Invisible (see render): only its click target matters.
        text: context === "signup" ? "signup_with" : "continue_with",
        logo_alignment: "center",
        width: Math.max(200, Math.min(400, slot.current.clientWidth || 320)),
        locale: locale === "ar-MA" ? "ar" : locale,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [ready, usable, next, locale, context, router]);

  if (broken || !usable) return <>{fallback}</>;

  return (
    <div className="flex flex-col items-center gap-2">
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={() => setReady(true)}
        onError={() => setBroken(true)}
      />
      {/*
        Google's button is a cross-origin iframe we can't restyle. Our own
        button is drawn underneath and Google's sits on top at ~0 opacity, so
        the click (and keyboard focus) lands on Google's real button while
        the user sees one that matches the site.
      */}
      <div
        aria-busy={busy}
        className={`group relative w-full rounded-xl transition-opacity has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-flame/60 ${busy ? "pointer-events-none opacity-50" : ""}`}
      >
        <span
          aria-hidden
          className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-ink-700 bg-ink-900 py-3 text-sm font-medium text-paper transition-colors group-hover:border-ink-600 group-hover:text-flame"
        >
          <GoogleLogo className="size-5" weight="bold" />
          {label}
        </span>
        <div
          ref={slot}
          className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-xl opacity-[0.01] [&_iframe]:!m-0"
        />
      </div>
      {error && (
        <p role="alert" className="text-center text-sm text-danger">
          {failedLabel}
        </p>
      )}
    </div>
  );
}
