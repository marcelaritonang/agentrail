import { hostname } from "node:os";
import { S3Client } from "@aws-sdk/client-s3";

import { createS3BlobStore } from "@agentrail-sdk/blob";
import { TRACE_INCOMPLETE_AFTER_MS } from "@agentrail-sdk/config";
import {
  createControlRepository,
  createDatabase,
  createSpanRepository,
} from "@agentrail-sdk/db";
import {
  createRedisStreamsQueue,
  createRedisUsageEventQueue,
} from "@agentrail-sdk/queue";
import { runWorker } from "./main.js";
import { reconcileIncompleteTraces } from "./reconcile-incomplete.js";
import { runUsageWorker } from "./usage-main.js";

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const database = createDatabase(required("DATABASE_URL"));
const repository = createSpanRepository(database.db);
const controlRepository = createControlRepository(database.db);
const queue = await createRedisStreamsQueue({
  url: required("REDIS_URL"),
  stream: process.env.AGENTRAIL_STREAM ?? "agentrail:spans",
  group: process.env.AGENTRAIL_CONSUMER_GROUP ?? "agentrail-workers",
  consumer: `${hostname()}-${process.pid}`,
  blockMs: 1_000,
});
const usageQueue = await createRedisUsageEventQueue({
  url: required("REDIS_URL"),
  stream: process.env.AGENTRAIL_USAGE_STREAM ?? "agentrail:usage-events",
  group:
    process.env.AGENTRAIL_USAGE_CONSUMER_GROUP ?? "agentrail-usage-workers",
  consumer: `${hostname()}-${process.pid}-usage`,
  blockMs: 1_000,
});
const s3 = new S3Client({
  endpoint: required("S3_ENDPOINT"),
  region: process.env.S3_REGION ?? "us-east-1",
  forcePathStyle: true,
  credentials: {
    accessKeyId: required("S3_ACCESS_KEY_ID"),
    secretAccessKey: required("S3_SECRET_ACCESS_KEY"),
  },
});
const blob = createS3BlobStore({ client: s3, bucket: required("S3_BUCKET") });
const controller = new AbortController();
const reconcileTimer = setInterval(
  () =>
    void reconcileIncompleteTraces({
      now: new Date(),
      timeoutMs: TRACE_INCOMPLETE_AFTER_MS,
      repository,
    }),
  60_000,
);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => controller.abort());
}

try {
  await Promise.all([
    runWorker(
      { queue, repository, blob },
      { signal: controller.signal, idleDelayMs: 100 },
    ),
    runUsageWorker(
      { queue: usageQueue, repository: controlRepository },
      { signal: controller.signal, idleDelayMs: 100 },
    ),
  ]);
} finally {
  clearInterval(reconcileTimer);
  queue.close();
  usageQueue.close();
  s3.destroy();
  await database.close();
}
