import type { MetadataRoute } from "next";
import { SITE_NAME } from "@/lib/site";

/** PWA manifest (roadmap 2.1) — served at /manifest.webmanifest. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description:
      "So3ra (سعرة) — calorie and macro tracker with per-gram precision, adaptive targets and an AI coach.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#090b08",
    theme_color: "#090b08",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      // Full-bleed design: safe to use as maskable.
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
