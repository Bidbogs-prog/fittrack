import type { MetadataRoute } from "next";

/** PWA manifest (roadmap 2.1) — served at /manifest.webmanifest. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FitTrack",
    short_name: "FitTrack",
    description:
      "Fitness tracker with precise per-gram nutrition, adaptive targets and an AI coach.",
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
