import type { CanonicalUsageEventBatch } from "@agentrail-sdk/queue";
import { describe, expect, it } from "vitest";

import {
  processUsageBatch,
  type UsageWorkerRepository,
} from "./process-usage.js";

const PROJECT_ID = "00000000-0000-4000-8000-000000000001";
const INSTALLATION_ID = "inst_01";

type StoredPack = {
  status: "ready" | "partial" | "empty";
  candidateTokensEstimate: number;
  returnedTokensEstimate: number;
  sourceCounts: Record<string, number>;
  warningCodes: readonly string[];
  outcome: "helpful" | "partial" | "missed" | "failed" | null;
  reasonCode: string | null;
};

class MemoryUsageWorkerRepository implements UsageWorkerRepository {
  readonly usageEvents = new Set<string>();
  readonly contextPacks = new Map<string, StoredPack>();
  readonly dailyUsage = new Map<
    string,
    {
      contextPackCreatedCount: number;
      contextOutcomeReportedCount: number;
      candidateTokensEstimate: number;
      returnedTokensEstimate: number;
    }
  >();
  installationActivatedAt: Date | null = null;
  installationLastSeenAt: Date | null = null;

  async insertUsageEvent(
    input: Parameters<UsageWorkerRepository["insertUsageEvent"]>[0],
  ) {
    const key = `${input.installationId}:${input.eventId}`;
    if (this.usageEvents.has(key)) return "duplicate" as const;
    this.usageEvents.add(key);
    return "inserted" as const;
  }

  async upsertContextPack(
    input: Parameters<UsageWorkerRepository["upsertContextPack"]>[0],
  ) {
    this.contextPacks.set(input.packId, {
      status: input.status,
      candidateTokensEstimate: input.candidateTokensEstimate,
      returnedTokensEstimate: input.returnedTokensEstimate,
      sourceCounts: input.sourceCounts,
      warningCodes: input.warningCodes,
      outcome: input.outcome ?? null,
      reasonCode: input.reasonCode ?? null,
    });
  }

  async markInstallationUsage(
    input: Parameters<UsageWorkerRepository["markInstallationUsage"]>[0],
  ) {
    this.installationActivatedAt ??= input.seenAt;
    this.installationLastSeenAt = input.seenAt;
  }

  async incrementDailyUsage(
    input: Parameters<UsageWorkerRepository["incrementDailyUsage"]>[0],
  ) {
    const current = this.dailyUsage.get(input.day) ?? {
      contextPackCreatedCount: 0,
      contextOutcomeReportedCount: 0,
      candidateTokensEstimate: 0,
      returnedTokensEstimate: 0,
    };
    this.dailyUsage.set(input.day, {
      contextPackCreatedCount:
        current.contextPackCreatedCount +
        (input.eventType === "context_pack_created" ? 1 : 0),
      contextOutcomeReportedCount:
        current.contextOutcomeReportedCount +
        (input.eventType === "context_outcome_reported" ? 1 : 0),
      candidateTokensEstimate:
        current.candidateTokensEstimate + input.candidateTokensEstimate,
      returnedTokensEstimate:
        current.returnedTokensEstimate + input.returnedTokensEstimate,
    });
  }
}

function batch(
  eventType:
    | "context_pack_created"
    | "context_outcome_reported" = "context_pack_created",
): CanonicalUsageEventBatch {
  return {
    events: [
      {
        schema_version: 1,
        project_id: PROJECT_ID,
        installation_id: INSTALLATION_ID,
        received_at: "2026-07-30T00:00:05.000Z",
        event_id: "ev_000000000000000000000001",
        pack_id: "cp_000000000000000000000001",
        event_type: eventType,
        occurred_at: "2026-07-30T00:00:00.000Z",
        safe_attributes: {
          client: "mcp",
          package_version: "0.1.2",
          status: "ready",
          latency_ms: 32,
          candidate_tokens_estimate: 2_000,
          returned_tokens_estimate: 800,
          source_counts: { project_source: 3, project_documentation: 1 },
          warning_codes: ["cache_rebuilt"],
          ...(eventType === "context_outcome_reported"
            ? { outcome: "helpful" as const, reason_code: "accepted" }
            : {}),
        },
      },
    ],
  };
}

describe("processUsageBatch", () => {
  it("does not inflate context pack metrics or daily aggregates for duplicate events", async () => {
    const repository = new MemoryUsageWorkerRepository();

    await expect(processUsageBatch({ repository }, batch())).resolves.toEqual({
      inserted: 1,
      duplicates: 0,
    });
    await expect(processUsageBatch({ repository }, batch())).resolves.toEqual({
      inserted: 0,
      duplicates: 1,
    });

    expect(repository.usageEvents.size).toBe(1);
    expect(
      repository.contextPacks.get("cp_000000000000000000000001"),
    ).toMatchObject({
      status: "ready",
      candidateTokensEstimate: 2_000,
      returnedTokensEstimate: 800,
      sourceCounts: { project_source: 3, project_documentation: 1 },
      warningCodes: ["cache_rebuilt"],
    });
    expect(repository.dailyUsage.get("2026-07-30")).toEqual({
      contextPackCreatedCount: 1,
      contextOutcomeReportedCount: 0,
      candidateTokensEstimate: 2_000,
      returnedTokensEstimate: 800,
    });
  });

  it("updates safe context pack outcome metrics without storing task text or file content", async () => {
    const repository = new MemoryUsageWorkerRepository();

    await processUsageBatch({ repository }, batch("context_outcome_reported"));

    expect(repository.contextPacks.get("cp_000000000000000000000001")).toEqual({
      status: "ready",
      candidateTokensEstimate: 2_000,
      returnedTokensEstimate: 800,
      sourceCounts: { project_source: 3, project_documentation: 1 },
      warningCodes: ["cache_rebuilt"],
      outcome: "helpful",
      reasonCode: "accepted",
    });
  });

  it("marks first successful pack activation and then advances installation last seen", async () => {
    const repository = new MemoryUsageWorkerRepository();

    await processUsageBatch({ repository }, batch());
    await processUsageBatch(
      { repository },
      {
        events: [
          {
            ...batch().events[0],
            event_id: "ev_000000000000000000000002",
            occurred_at: "2026-07-30T00:10:00.000Z",
          },
        ],
      },
    );

    expect(repository.installationActivatedAt?.toISOString()).toBe(
      "2026-07-30T00:00:00.000Z",
    );
    expect(repository.installationLastSeenAt?.toISOString()).toBe(
      "2026-07-30T00:10:00.000Z",
    );
  });
});
