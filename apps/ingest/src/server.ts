import { serve } from "@hono/node-server";
import type { Hono } from "hono";

export function serveIngestApp(app: Hono, port = 3_001) {
  return serve({ fetch: app.fetch, port });
}
