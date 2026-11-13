import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Vercel rejects function request bodies above 4.5 MB, so a higher limit here could
      // never be reached. Uploaded files are limited to 4 MB (see src/lib/uploads.ts).
      bodySizeLimit: "4.5mb",
    },
  },
};

export default nextConfig;
