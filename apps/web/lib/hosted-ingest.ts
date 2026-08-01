import { randomUUID } from "node:crypto";
import { SQSClient } from "@aws-sdk/client-sqs";

import {
  createIngestApp,
  type IngestDependencies,
} from "@agentrail-sdk/ingest";
import {
  createControlRepository,
  createSpanRepository,
  type CanonicalUsageEvent,
  type ContextPackMetricWrite,
  type DailyUsageDelta,
} from "@agentrail-sdk/db";
import {
  createRedisStreamsQueue,
  createSqsSpanQueue,
  type CanonicalUsageEventBatch,
  type QueueMessage,
  type SpanQueue,
  type UsageEventQueue,
  type UsageQueueMessage,
} from "@agentrail-sdk/queue";
import { getControlDatabase } from "./control-database";

type HostedIngestApp = ReturnType<typeof createIngestApp>;

type HostedIngestAppLike = {
  request(request: Request): Response | Promise<Response>;
};

type UsageMetricRepository = {
  insertUsageEvent(
    input: CanonicalUsageEvent,
  ): Promise<"inserted" | "duplicate">;
  upsertContextPack(input: ContextPackMetricWrite): Promise<void>;
  markInstallationUsage(input: {
    projectId: string;
    installationId: string;
    seenAt: Date;
  }): Promise<void>;
  incrementDailyUsage(input: DailyUsageDelta): Promise<void>;
};

let hostedIngestAppPromise: Promise<HostedIngestApp> | null = null;
let spanQueuePromise: Promise<SpanQueue> | null = null;

export const hostedIngestRequestHandler = createHostedIngestRequestHandler(
  getHostedIngestApp,
);

export function createHostedIngestRequestHandler(
  resolveApp: () => Promise<HostedIngestAppLike>,
) {
  return async function handleHostedIngestRequest(
    request: Request,
  ): Promise<Response> {
    try {
      const app = await resolveApp();
      return app.request(request);
    } catch {
      return Response.json(
        {
          error: {
            code: "service_unavailable",
            message: "Hosted ingestion is not configured",
            request_id: "req_unavailable",
            retryable: true,
          },
        },
        { status: 503 },
      );
    }
  };
}

export async function getHostedIngestApp(): Promise<HostedIngestApp> {
  hostedIngestAppPromise ??= createProductionHostedIngestApp();
  return hostedIngestAppPromise;
}

export async function createProductionHostedIngestApp(): Promise<HostedIngestApp> {
  const database = getControlDatabase();
  const spanRepository = createSpanRepository(database.db);
  const controlRepository = createControlRepository(database.db);
  const installationCredentialPepper = process.env
    .INSTALLATION_CREDENTIAL_PEPPER;
  const activationBaseUrl = activationUrl();

  const dependencies: IngestDependencies = {
    apiKeyPepper:
      process.env.API_KEY_PEPPER ?? "agentrail-unconfigured-api-key-pepper",
    apiKeys: spanRepository,
    queue: await getHostedSpanQueue(),
    usageQueue: createDirectUsageEventQueue(controlRepository),
    deviceCodes: controlRepository,
    installations: controlRepository,
    activationBaseUrl,
    requestId: () => `req_${randomUUID()}`,
    now: () => new Date(),
    ...(installationCredentialPepper === undefined ||
    installationCredentialPepper.length === 0
      ? {}
      : { installationCredentialPepper }),
  };

  return createIngestApp(dependencies);
}

export function createDirectUsageEventQueue(
  repository: UsageMetricRepository,
): UsageEventQueue {
  return {
    async enqueue(batch: CanonicalUsageEventBatch) {
      let inserted = 0;
      let duplicates = 0;

      for (const event of batch.events) {
        const canonical = canonicalUsageEvent(event);
        const result = await repository.insertUsageEvent(canonical);
        if (result === "duplicate") {
          duplicates += 1;
          continue;
        }

        await repository.upsertContextPack(metricFromEvent(canonical));
        await repository.markInstallationUsage({
          projectId: canonical.projectId,
          installationId: canonical.installationId,
          seenAt: canonical.occurredAt,
        });
        await repository.incrementDailyUsage(deltaFromEvent(canonical));
        inserted += 1;
      }

      return {
        messageId: `direct_usage_${inserted}_${duplicates}_${randomUUID()}`,
      };
    },

    async read(): Promise<UsageQueueMessage | null> {
      return null;
    },

    async ack(_message: UsageQueueMessage): Promise<void> {
      return undefined;
    },

    async fail(_message: UsageQueueMessage, _reason: string): Promise<void> {
      return undefined;
    },
  };
}

async function getHostedSpanQueue(): Promise<SpanQueue> {
  spanQueuePromise ??= createHostedSpanQueue();
  return spanQueuePromise;
}

async function createHostedSpanQueue(): Promise<SpanQueue> {
  const sqsQueueUrl = process.env.AGENTRAIL_SPAN_QUEUE_URL?.trim();
  if (sqsQueueUrl) {
    const region = sqsRegion();
    return createSqsSpanQueue({
      client: new SQSClient(region ? { region } : {}),
      queueUrl: sqsQueueUrl,
    });
  }

  const redisUrl = process.env.REDIS_URL?.trim();
  if (redisUrl) {
    return createRedisStreamsQueue({
      url: redisUrl,
      stream: process.env.AGENTRAIL_STREAM ?? "agentrail:spans",
      group: process.env.AGENTRAIL_CONSUMER_GROUP ?? "agentrail-workers",
      consumer: `web-ingest-${process.pid}`,
      blockMs: 100,
    });
  }

  return createUnavailableSpanQueue();
}

function createUnavailableSpanQueue(): SpanQueue {
  return {
    async enqueue() {
      throw new Error("Span queue is not configured.");
    },

    async read(): Promise<QueueMessage | null> {
      return null;
    },

    async ack(_message: QueueMessage): Promise<void> {
      return undefined;
    },

    async fail(_message: QueueMessage, _reason: string): Promise<void> {
      return undefined;
    },
  };
}

function canonicalUsageEvent(
  event: CanonicalUsageEventBatch["events"][number],
): CanonicalUsageEvent {
  return {
    projectId: event.project_id,
    installationId: event.installation_id,
    eventId: event.event_id,
    packId: event.pack_id,
    eventType: event.event_type,
    occurredAt: new Date(event.occurred_at),
    safeAttributes: {
      client: event.safe_attributes.client,
      packageVersion: event.safe_attributes.package_version,
      status: event.safe_attributes.status,
      latencyMs: event.safe_attributes.latency_ms,
      candidateTokensEstimate: event.safe_attributes.candidate_tokens_estimate,
      returnedTokensEstimate: event.safe_attributes.returned_tokens_estimate,
      sourceCounts: event.safe_attributes.source_counts,
      warningCodes: event.safe_attributes.warning_codes,
      ...(event.safe_attributes.outcome === undefined
        ? {}
        : { outcome: event.safe_attributes.outcome }),
      ...(event.safe_attributes.reason_code === undefined
        ? {}
        : { reasonCode: event.safe_attributes.reason_code }),
    },
  };
}

function metricFromEvent(event: CanonicalUsageEvent): ContextPackMetricWrite {
  return {
    projectId: event.projectId,
    packId: event.packId,
    status: event.safeAttributes.status,
    candidateTokensEstimate: event.safeAttributes.candidateTokensEstimate,
    returnedTokensEstimate: event.safeAttributes.returnedTokensEstimate,
    sourceCounts: event.safeAttributes.sourceCounts,
    warningCodes: event.safeAttributes.warningCodes,
    occurredAt: event.occurredAt,
    ...(event.safeAttributes.outcome === undefined
      ? {}
      : { outcome: event.safeAttributes.outcome }),
    ...(event.safeAttributes.reasonCode === undefined
      ? {}
      : { reasonCode: event.safeAttributes.reasonCode }),
  };
}

function deltaFromEvent(event: CanonicalUsageEvent): DailyUsageDelta {
  return {
    projectId: event.projectId,
    day: event.occurredAt.toISOString().slice(0, 10),
    eventType: event.eventType,
    candidateTokensEstimate: event.safeAttributes.candidateTokensEstimate,
    returnedTokensEstimate: event.safeAttributes.returnedTokensEstimate,
  };
}

function activationUrl(): string {
  const explicit = process.env.AGENTRAIL_ACTIVATION_BASE_URL?.trim();
  if (explicit) {
    return explicit;
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_AGENTRAIL_SITE_URL?.trim() ?? "https://agentrail.id";
  return `${siteUrl.replace(/\/+$/, "")}/activate`;
}

function sqsRegion(): string | undefined {
  return (
    process.env.AWS_REGION?.trim() ||
    process.env.AWS_DEFAULT_REGION?.trim() ||
    undefined
  );
}
