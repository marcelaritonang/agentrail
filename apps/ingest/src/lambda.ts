import { SQSClient } from "@aws-sdk/client-sqs";
import { handle } from "hono/aws-lambda";

import {
  createControlRepository,
  createDatabase,
  createSpanRepository,
} from "@agentrail-sdk/db";
import {
  createSqsSpanQueue,
  createSqsUsageEventQueue,
} from "@agentrail-sdk/queue";
import { createIngestApp } from "./app.js";
import { createInMemoryDeviceIssueLimiter } from "./device.js";

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const database = createDatabase(required("DATABASE_URL"));
const spanRepository = createSpanRepository(database.db);
const controlRepository = createControlRepository(database.db);
const sqsRegion = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION;
const sqs = new SQSClient(sqsRegion ? { region: sqsRegion } : {});

export const app = createIngestApp({
  apiKeyPepper: required("API_KEY_PEPPER"),
  apiKeys: spanRepository,
  queue: createSqsSpanQueue({
    client: sqs,
    queueUrl: required("AGENTRAIL_SPAN_QUEUE_URL"),
  }),
  usageQueue: createSqsUsageEventQueue({
    client: sqs,
    queueUrl: required("AGENTRAIL_USAGE_QUEUE_URL"),
  }),
  deviceCodes: controlRepository,
  installations: controlRepository,
  installationCredentialPepper: required("INSTALLATION_CREDENTIAL_PEPPER"),
  activationBaseUrl:
    process.env.AGENTRAIL_ACTIVATION_BASE_URL ??
    "https://agentrail.id/activate",
  deviceIssueRateLimit: createInMemoryDeviceIssueLimiter({
    maxPerWindow: Number(process.env.AGENTRAIL_DEVICE_CODE_RATE_LIMIT ?? "20"),
    windowMs: 60_000,
  }),
});

export const handler = handle(app);
