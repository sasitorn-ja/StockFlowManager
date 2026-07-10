import type { NextConfig } from "next";
import { appBasePath } from "./lib/base-path";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "10.114.240.216",
    "10.114.247.189",
    "10.114.*.*",
    "10.*.*.*",
    "192.168.*.*",
  ],
  basePath: appBasePath || undefined,
  output: "standalone",
  reactStrictMode: true,
};

export default nextConfig;
