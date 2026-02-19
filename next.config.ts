import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    // Don’t fail `next build` on lint errors (still run `npm run lint` manually)
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
