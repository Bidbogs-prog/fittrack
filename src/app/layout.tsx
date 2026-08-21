import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Outfit } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Analytics } from "@/components/analytics";
import { SwRegister } from "@/components/sw-register";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";
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
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — ${SITE_TAGLINE.toLowerCase()}`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "calorie tracker",
    "macro tracker",
    "nutrition tracker",
    "Moroccan food calories",
    "TDEE calculator",
    "meal planner",
    "so3ra",
    "سعرة",
    "حاسبة السعرات الحرارية",
    "compteur de calories",
  ],
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — ${SITE_TAGLINE.toLowerCase()}`,
    description: SITE_DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — ${SITE_TAGLINE.toLowerCase()}`,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
  // PWA (roadmap 2.1): the manifest link comes from src/app/manifest.ts.
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
    statusBarStyle: "black-translucent",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Locale comes from the cookie (src/i18n/request.ts); Arabic flips the
  // whole document to RTL.
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      dir={locale === "ar" ? "rtl" : "ltr"}
      className={`${geistSans.variable} ${geistMono.variable} ${outfit.variable} antialiased`}
    >
      {/* min-h-[100dvh] (not h-full chains): tracks the iOS dynamic toolbar
          without leaving a spurious scrollable gap. pt-safe-area: the
          installed iOS app draws under the translucent status bar
          (black-translucent + viewport-fit=cover); env() is 0 elsewhere. */}
      <body className="grain flex min-h-[100dvh] flex-col pt-[env(safe-area-inset-top)]">
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
        <SwRegister />
        <Analytics />
      </body>
    </html>
  );
}
