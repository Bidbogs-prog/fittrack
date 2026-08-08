import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // AI meal photos: downscaled client-side, but larger than the 1 MB default.
      bodySizeLimit: "4mb",
    },
  },
};

export default withNextIntl(nextConfig);
