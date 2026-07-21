import { serve } from "@hono/node-server";
import type { Env, Hono } from "hono";

export function serveIngestApp<E extends Env>(app: Hono<E>, port = 3_001) {
  return serve({ fetch: app.fetch, port });
}
