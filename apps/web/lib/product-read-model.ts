import { and, eq, gte, lt } from "drizzle-orm";

import {
  installations,
  projects,
  usageEvents,
  type AgentRailDatabase,
  type ContextOutcome,
  type ContextPackStatus,
  type PrivacyMode,
  type UsageEventType,
} from "@agentrail-sdk/db";

export type UserOverview = {
  packs7d: number;
  packs30d: number;
  contextReductionEstimate30d: number;
  reuseRate30d: number | null;
  connectedClients: number;
  staleDecisions: number;
  latestError: { code: string; occurredAt: string } | null;
  nextAction:
    "install" | "activate" | "create_first_pack" | "report_outcome" | null;
};

export type IntegrationRecord = {
  installationId: string;
  client: "codex" | "claude";
  packageVersion: string;
  privacyMode: PrivacyMode;
  connectedAt: string;
  activatedAt: string | null;
  lastSeenAt: string | null;
  revokedAt: string | null;
  status: "connected" | "waiting" | "stale" | "revoked";
  workspaceCount: number | null;
  lastSuccessfulPackAt: string | null;
  staleVersionWarning: string | null;
};

type UsageRow = {
  installationId: string;
  eventType: UsageEventType;
  occurredAt: Date;
  status: ContextPackStatus;
  candidateTokensEstimate: number;
  returnedTokensEstimate: number;
  outcome: ContextOutcome | null;
  reasonCode: string | null;
};

type InstallationRow = Awaited<ReturnType<typeof readInstallations>>[number];

const STALE_CLIENT_AFTER_MS = 14 * 24 * 60 * 60 * 1_000;
const MIN_RECOMMENDED_PACKAGE_VERSION = "0.1.1";

export function createProductReadModel(db: AgentRailDatabase) {
  return {
    async getUserOverview(input: {
      projectId: string;
      now: Date;
    }): Promise<UserOverview> {
      const [installationRows, allUsageRows, usage30dRows] = await Promise.all([
        readInstallations(db, input.projectId),
        readUsageRows(db, {
          projectId: input.projectId,
          before: input.now,
        }),
        readUsageRows(db, {
          projectId: input.projectId,
          from: daysBefore(input.now, 30),
          before: input.now,
        }),
      ]);

      const activeInstallations = installationRows.filter(
        (installation) => installation.revokedAt === null,
      );
      const created30d = usage30dRows.filter(
        (event) => event.eventType === "context_pack_created",
      );
      const created7d = created30d.filter(
        (event) =>
          event.occurredAt.getTime() >= daysBefore(input.now, 7).getTime(),
      );
      const outcomes30d = usage30dRows.filter(
        (event) => event.eventType === "context_outcome_reported",
      );
      const usefulOutcomes30d = outcomes30d.filter(
        (event) => event.outcome === "helpful" || event.outcome === "partial",
      );
      const failedEvents = allUsageRows
        .filter((event) => event.outcome === "failed")
        .sort(
          (left, right) =>
            right.occurredAt.getTime() - left.occurredAt.getTime(),
        );

      return {
        packs7d: created7d.length,
        packs30d: created30d.length,
        contextReductionEstimate30d: reductionPercent(created30d),
        reuseRate30d:
          outcomes30d.length === 0
            ? null
            : roundRatio(usefulOutcomes30d.length / outcomes30d.length),
        connectedClients: activeInstallations.length,
        staleDecisions: activeInstallations.filter((installation) =>
          isStale(installation.lastSeenAt, input.now),
        ).length,
        latestError:
          failedEvents.length === 0
            ? null
            : {
                code: failedEvents[0]?.reasonCode ?? "context_failed",
                occurredAt: toIso(failedEvents[0]?.occurredAt ?? input.now),
              },
        nextAction: nextAction(activeInstallations, allUsageRows),
      };
    },

    async listIntegrations(input: {
      projectId: string;
      now: Date;
    }): Promise<readonly IntegrationRecord[]> {
      const [installationRows, allUsageRows, [project]] = await Promise.all([
        readInstallations(db, input.projectId),
        readUsageRows(db, {
          projectId: input.projectId,
          before: input.now,
        }),
        db
          .select({ privacyMode: projects.privacyMode })
          .from(projects)
          .where(eq(projects.projectId, input.projectId))
          .limit(1),
      ]);

      const privacyMode = project?.privacyMode ?? "local-only";

      return installationRows.map((installation) => {
        const lastSuccessfulPack = allUsageRows
          .filter(
            (event) =>
              event.installationId === installation.installationId &&
              event.eventType === "context_pack_created" &&
              event.status !== "empty",
          )
          .sort(
            (left, right) =>
              right.occurredAt.getTime() - left.occurredAt.getTime(),
          )[0];

        return {
          installationId: installation.installationId,
          client: installation.clientType,
          packageVersion: installation.packageVersion,
          privacyMode,
          connectedAt: toIso(installation.createdAt),
          activatedAt:
            installation.activatedAt === null
              ? null
              : toIso(installation.activatedAt),
          lastSeenAt:
            installation.lastSeenAt === null
              ? null
              : toIso(installation.lastSeenAt),
          revokedAt:
            installation.revokedAt === null
              ? null
              : toIso(installation.revokedAt),
          status: integrationStatus(installation, input.now),
          workspaceCount: null,
          lastSuccessfulPackAt:
            lastSuccessfulPack === undefined
              ? null
              : toIso(lastSuccessfulPack.occurredAt),
          staleVersionWarning: isVersionStale(installation.packageVersion)
            ? "Upgrade to the latest AgentRail package."
            : null,
        };
      });
    },
  };
}

async function readInstallations(db: AgentRailDatabase, projectId: string) {
  return db
    .select({
      installationId: installations.installationId,
      clientType: installations.clientType,
      packageVersion: installations.packageVersion,
      createdAt: installations.createdAt,
      activatedAt: installations.activatedAt,
      lastSeenAt: installations.lastSeenAt,
      revokedAt: installations.revokedAt,
    })
    .from(installations)
    .where(eq(installations.projectId, projectId));
}

async function readUsageRows(
  db: AgentRailDatabase,
  input: { projectId: string; from?: Date; before?: Date },
): Promise<readonly UsageRow[]> {
  const filters = [eq(usageEvents.projectId, input.projectId)];
  if (input.from !== undefined) {
    filters.push(gte(usageEvents.occurredAt, input.from));
  }
  if (input.before !== undefined) {
    filters.push(lt(usageEvents.occurredAt, input.before));
  }

  return db
    .select({
      installationId: usageEvents.installationId,
      eventType: usageEvents.eventType,
      occurredAt: usageEvents.occurredAt,
      status: usageEvents.status,
      candidateTokensEstimate: usageEvents.candidateTokensEstimate,
      returnedTokensEstimate: usageEvents.returnedTokensEstimate,
      outcome: usageEvents.outcome,
      reasonCode: usageEvents.reasonCode,
    })
    .from(usageEvents)
    .where(and(...filters));
}

function nextAction(
  activeInstallations: readonly InstallationRow[],
  usageRows: readonly UsageRow[],
): UserOverview["nextAction"] {
  if (activeInstallations.length === 0) {
    return "install";
  }
  if (
    activeInstallations.every(
      (installation) => installation.activatedAt === null,
    )
  ) {
    return "activate";
  }
  if (!usageRows.some((event) => event.eventType === "context_pack_created")) {
    return "create_first_pack";
  }
  if (
    !usageRows.some((event) => event.eventType === "context_outcome_reported")
  ) {
    return "report_outcome";
  }
  return null;
}

function reductionPercent(events: readonly UsageRow[]): number {
  const totals = events.reduce(
    (sum, event) => ({
      candidate: sum.candidate + event.candidateTokensEstimate,
      returned: sum.returned + event.returnedTokensEstimate,
    }),
    { candidate: 0, returned: 0 },
  );
  if (totals.candidate <= 0) {
    return 0;
  }
  return Math.max(
    0,
    Math.round(((totals.candidate - totals.returned) / totals.candidate) * 100),
  );
}

function integrationStatus(
  installation: InstallationRow,
  now: Date,
): IntegrationRecord["status"] {
  if (installation.revokedAt !== null) {
    return "revoked";
  }
  if (installation.activatedAt === null) {
    return "waiting";
  }
  if (isStale(installation.lastSeenAt, now)) {
    return "stale";
  }
  return "connected";
}

function isStale(lastSeenAt: Date | null, now: Date): boolean {
  return (
    lastSeenAt !== null &&
    now.getTime() - lastSeenAt.getTime() > STALE_CLIENT_AFTER_MS
  );
}

function daysBefore(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1_000);
}

function roundRatio(value: number): number {
  return Math.round(value * 100) / 100;
}

function toIso(value: Date): string {
  return value.toISOString();
}

function isVersionStale(version: string): boolean {
  return (
    version.localeCompare(MIN_RECOMMENDED_PACKAGE_VERSION, undefined, {
      numeric: true,
      sensitivity: "base",
    }) < 0
  );
}
