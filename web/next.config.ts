import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb", // GPX files from Strava/Garmin can be several MB
    },
  },
};

export default nextConfig;
