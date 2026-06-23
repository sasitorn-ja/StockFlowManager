import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "10.114.240.216",
    "10.114.247.189",
    "10.114.*.*",
    "10.*.*.*",
    "192.168.*.*",
  ],
  reactStrictMode: true,
};

export default nextConfig;
