"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
  fallback,
}: {
  next?: string;
  locale: string;
  context: "signin" | "signup";
  failedLabel: string;
  fallback: React.ReactNode;
}) {
  const router = useRouter();
  const slot = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [broken, setBroken] = useState(!CLIENT_ID);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!ready || !CLIENT_ID || !slot.current || !window.google) return;
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
        text: context === "signup" ? "signup_with" : "continue_with",
        logo_alignment: "center",
        width: Math.min(400, slot.current.clientWidth || 320),
        locale: locale === "ar-MA" ? "ar" : locale,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [ready, next, locale, context, router]);

  if (broken) return <>{fallback}</>;

  return (
    <div className="flex flex-col items-center gap-2">
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={() => setReady(true)}
        onError={() => setBroken(true)}
      />
      <div
        ref={slot}
        aria-busy={busy}
        className={`flex min-h-11 w-full justify-center transition-opacity ${busy ? "pointer-events-none opacity-50" : ""}`}
      />
      {error && (
        <p role="alert" className="text-center text-sm text-danger">
          {failedLabel}
        </p>
      )}
    </div>
  );
}
