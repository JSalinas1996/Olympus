import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  serverExternalPackages: ["tesseract.js", "@tesseract.js-data/spa"],
  experimental: { serverActions: { bodySizeLimit: "45mb" } },
};

export default nextConfig;
