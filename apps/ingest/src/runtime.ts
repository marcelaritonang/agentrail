import {
  createControlRepository,
  createDatabase,
  createReceiptRepository,
  createSpanRepository,
} from "@agentrail-sdk/db";
import {
  createRedisStreamsQueue,
  createRedisUsageEventQueue,
} from "@agentrail-sdk/queue";
import { createIngestApp } from "./app.js";
import { createInMemoryDeviceIssueLimiter } from "./device.js";
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
const controlRepository = createControlRepository(database.db);
const receiptRepository = createReceiptRepository(database.db);
const queue = await createRedisStreamsQueue({
  url: required("REDIS_URL"),
  stream: process.env.AGENTRAIL_STREAM ?? "agentrail:spans",
  group: process.env.AGENTRAIL_CONSUMER_GROUP ?? "agentrail-workers",
  consumer: `ingest-${process.pid}`,
  blockMs: 100,
});
const usageQueue = await createRedisUsageEventQueue({
  url: required("REDIS_URL"),
  stream: process.env.AGENTRAIL_USAGE_STREAM ?? "agentrail:usage-events",
  group:
    process.env.AGENTRAIL_USAGE_CONSUMER_GROUP ?? "agentrail-usage-workers",
  consumer: `ingest-usage-${process.pid}`,
  blockMs: 100,
});
const app = createIngestApp({
  apiKeyPepper: required("API_KEY_PEPPER"),
  apiKeys: repository,
  queue,
  usageQueue,
  deviceCodes: controlRepository,
  installations: controlRepository,
  memories: {
    async upsert(input) {
      return receiptRepository.upsertMemory({
        projectId: input.projectId,
        memoryId: input.memory_id,
        revision: input.revision,
        type: input.type,
        status: input.status,
        statementRedacted: input.statementRedacted,
        scope: input.scope,
        sourceKind: input.source_kind,
        expiresAt:
          input.expires_at === null ? null : new Date(input.expires_at),
        updatedAt: new Date(input.updated_at),
        tombstone: input.tombstone ?? null,
      });
    },
  },
  installationCredentialPepper: required("INSTALLATION_CREDENTIAL_PEPPER"),
  activationBaseUrl:
    process.env.AGENTRAIL_ACTIVATION_BASE_URL ??
    "http://localhost:3000/activate",
  deviceIssueRateLimit: createInMemoryDeviceIssueLimiter({
    maxPerWindow: 20,
    windowMs: 60_000,
  }),
});
const server = serveIngestApp(app, Number(process.env.INGEST_PORT ?? "3001"));

async function shutdown(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error === undefined ? resolve() : reject(error)));
  });
  queue.close();
  usageQueue.close();
  await database.close();
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => void shutdown().finally(() => process.exit(0)));
}
