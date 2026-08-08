import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // AI meal photos: downscaled client-side, but larger than the 1 MB default.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
