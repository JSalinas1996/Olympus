import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  experimental: { serverActions: { bodySizeLimit: "45mb" } },
};

export default nextConfig;
