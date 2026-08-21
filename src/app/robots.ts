import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** Only the public marketing/auth surface is crawlable — the app is personal data. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/history",
        "/foods",
        "/plans",
        "/recipes",
        "/account",
        "/admin",
        "/onboarding",
        "/api/",
        "/auth/",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
