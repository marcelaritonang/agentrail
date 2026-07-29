import type { MetadataRoute } from "next";

import { readPublicAgentRailConfig } from "../lib/public-config";

export default function robots(): MetadataRoute.Robots {
  const { siteUrl } = readPublicAgentRailConfig();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
      },
    ],
    sitemap: new URL("/sitemap.xml", siteUrl).href,
  };
}
