import type {
  CanonicalUsageEventBatch,
  CanonicalUsageEvent as QueueCanonicalUsageEvent,
} from "@agentrail-sdk/queue";
import { assertCanonicalUsageEventBatch } from "@agentrail-sdk/queue";
import type {
  CanonicalUsageEvent,
  ContextPackMetricWrite,
  DailyUsageDelta,
} from "@agentrail-sdk/db";

export type UsageWorkerRepository = {
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

export type ProcessUsageBatchDependencies = {
  repository: UsageWorkerRepository;
};

export type ProcessUsageBatchResult = {
  inserted: number;
  duplicates: number;
};

export async function processUsageBatch(
  dependencies: ProcessUsageBatchDependencies,
  input: unknown,
): Promise<ProcessUsageBatchResult> {
  assertCanonicalUsageEventBatch(input);
  const batch = input as CanonicalUsageEventBatch;
  let inserted = 0;
  let duplicates = 0;

  for (const event of batch.events) {
    const canonical = canonicalUsageEvent(event);
    const outcome = await dependencies.repository.insertUsageEvent(canonical);
    if (outcome === "duplicate") {
      duplicates += 1;
      continue;
    }

    await dependencies.repository.upsertContextPack(metricFromEvent(canonical));
    await dependencies.repository.markInstallationUsage({
      projectId: canonical.projectId,
      installationId: canonical.installationId,
      seenAt: canonical.occurredAt,
    });
    await dependencies.repository.incrementDailyUsage(
      deltaFromEvent(canonical),
    );
    inserted += 1;
  }

  return { inserted, duplicates };
}

function canonicalUsageEvent(
  event: QueueCanonicalUsageEvent,
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
