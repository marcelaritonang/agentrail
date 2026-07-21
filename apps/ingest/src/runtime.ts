import { createDatabase, createSpanRepository } from "@agentrail/db";
import { createRedisStreamsQueue } from "@agentrail/queue";
import { createIngestApp } from "./app.js";
import { serveIngestApp } from "./server.js";

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const database = createDatabase(required("DATABASE_URL"));
const repository = createSpanRepository(database.db);
const queue = await createRedisStreamsQueue({
  url: required("REDIS_URL"),
  stream: process.env.AGENTRAIL_STREAM ?? "agentrail:spans",
  group: process.env.AGENTRAIL_CONSUMER_GROUP ?? "agentrail-workers",
  consumer: `ingest-${process.pid}`,
  blockMs: 100,
});
const app = createIngestApp({
  apiKeyPepper: required("API_KEY_PEPPER"),
  apiKeys: repository,
  queue,
});
const server = serveIngestApp(app, Number(process.env.INGEST_PORT ?? "3001"));

async function shutdown(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error === undefined ? resolve() : reject(error)));
  });
  queue.close();
  await database.close();
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => void shutdown().finally(() => process.exit(0)));
}
