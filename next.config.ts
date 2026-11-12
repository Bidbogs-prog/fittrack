import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Reuse a visited page's RSC payload for 30s on tab switches, so hopping
    // between tabs doesn't re-run every Supabase read and flash a skeleton.
    // Mutations stay fresh: server actions (revalidatePath) and
    // router.refresh() purge this cache.
    staleTimes: {
      dynamic: 30,
    },
    serverActions: {
      // AI meal photos: downscaled client-side, but larger than the 1 MB default.
      bodySizeLimit: "4mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          // Baseline CSP (audit #9b): no framing, no <base> hijack, no plugins.
          // script-src is left open for now (Next inline bootstrap, Turnstile,
          // Google sign-in, PostHog) — tightening it needs nonces.
          {
            key: "Content-Security-Policy",
            // form-action: our own server actions, plus the sign-in providers a
            // no-JS form post may be redirected to (Supabase auth → Google).
            value:
              "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self' https://*.supabase.co https://accounts.google.com",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
