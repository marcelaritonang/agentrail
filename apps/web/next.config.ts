import { fileURLToPath } from "node:url";

import type { NextConfig } from "next";

import { configuredSourceUrl } from "./lib/source-url";

configuredSourceUrl();

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  devIndicators: false,
  output: "standalone",
  outputFileTracingRoot: fileURLToPath(new URL("../..", import.meta.url)),
};

export default nextConfig;
