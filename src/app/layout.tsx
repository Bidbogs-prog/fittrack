import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Outfit } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

// viewportFit: "cover" makes env(safe-area-inset-*) resolve on notched
// phones — the sticky mobile nav pads itself with it.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#090b08",
};

export const metadata: Metadata = {
  title: {
    default: "FitTrack — eat exact, train hard",
    template: "%s · FitTrack",
  },
  description:
    "Fitness tracker with precise per-gram nutrition, TDEE-based targets and coach-built meal plans.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${outfit.variable} antialiased`}
    >
      {/* min-h-[100dvh] (not h-full chains): tracks the iOS dynamic toolbar
          without leaving a spurious scrollable gap. */}
      <body className="grain flex min-h-[100dvh] flex-col">{children}</body>
    </html>
  );
}
