import type { MetadataRoute } from "next";

import { readPublicAgentRailConfig } from "../lib/public-config";

const PUBLIC_ROUTES = [
  "/",
  "/about",
  "/architecture",
  "/founding-testers",
  "/privacy",
  "/security",
  "/terms",
  "/traces",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const { siteUrl } = readPublicAgentRailConfig();

  return PUBLIC_ROUTES.map((route) => ({
    url: new URL(route, siteUrl).href,
    changeFrequency: route === "/" ? "weekly" : "monthly",
    priority: route === "/" ? 1 : route === "/traces" ? 0.9 : 0.7,
  }));
}
