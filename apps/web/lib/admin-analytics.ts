import { and, gte, lt } from "drizzle-orm";

import {
  accounts,
  dailyUsage,
  installations,
  projects,
  usageEvents,
  type AgentRailDatabase,
  type ContextOutcome,
  type UsageEventType,
} from "@agentrail-sdk/db";

import type { AuthenticatedViewer } from "./authz";

export type CountBucket = {
  label: string;
  count: number;
};

export type FounderAnalytics = {
  authenticatedUsers: number;
  activatedInstallations: number;
  activeUsers7d: number;
  activeUsers30d: number;
  firstPackConversion: number | null;
  weeklyRetention: number | null;
  packsPerActiveUser30d: number | null;
  clientDistribution: readonly CountBucket[];
  versionDistribution: readonly CountBucket[];
  privacyModeDistribution: readonly CountBucket[];
  errorRate30d: number | null;
  p95LatencyMs30d: number | null;
  npmDownloads: {
    value: number | null;
    period: string;
    source: "npm" | "unavailable";
  };
};

type NpmDownloads = FounderAnalytics["npmDownloads"];

type UsageRow = {
  projectId: string;
  installationId: string;
  eventType: UsageEventType;
  occurredAt: Date;
  latencyMs: number;
  outcome: ContextOutcome | null;
};

type InstallationRow = {
  projectId: string;
  installationId: string;
  clientType: "codex" | "claude";
  packageVersion: string;
  activatedAt: Date | null;
  revokedAt: Date | null;
};

type ProjectRow = {
  projectId: string;
  ownerUserId: string | null;
  privacyMode: "local-only" | "metrics-only" | "evidence-sync";
};

const NPM_DOWNLOAD_CACHE_MS = 24 * 60 * 60 * 1_000;
let npmDownloadCache:
  | {
      expiresAt: number;
      downloads: NpmDownloads;
    }
  | null = null;

export function createAdminAnalyticsReadModel(
  db: AgentRailDatabase,
  options: {
    readNpmDownloads?: () => Promise<NpmDownloads>;
  } = {},
) {
  return {
    async getFounderAnalytics(input: {
      now: Date;
    }): Promise<FounderAnalytics> {
      const thirtyDaysAgo = daysBefore(input.now, 30);
      const currentWeekStart = daysBefore(input.now, 7);
      const priorWeekStart = daysBefore(input.now, 14);

      const [
        accountRows,
        installationRows,
        projectRows,
        usageRows30d,
        usageRows14d,
        usageRowsAll,
        dailyRows,
        npmDownloads,
      ] = await Promise.all([
        readAccounts(db),
        readInstallations(db),
        readProjects(db),
        readUsageRows(db, {
          from: thirtyDaysAgo,
          before: input.now,
        }),
        readUsageRows(db, {
          from: priorWeekStart,
          before: input.now,
        }),
        readUsageRows(db, {
          before: input.now,
        }),
        readDailyUsageRows(db, {
          fromDay: toDateKey(thirtyDaysAgo),
          throughDay: toDateKey(input.now),
        }),
        readNpmDownloads(options.readNpmDownloads),
      ]);

      const authenticatedUserIds = new Set(
        accountRows.map((account) => account.userId),
      );
      const ownerByProjectId = new Map(
        projectRows
          .filter((project) => project.ownerUserId !== null)
          .map((project) => [project.projectId, project.ownerUserId as string]),
      );
      const activeUsers7d = activeUserIds({
        usageRows: usageRows14d.filter(
          (event) => event.occurredAt.getTime() >= currentWeekStart.getTime(),
        ),
        ownerByProjectId,
        authenticatedUserIds,
      });
      const activeUsers30d = activeUserIds({
        usageRows: usageRows30d,
        ownerByProjectId,
        authenticatedUserIds,
      });
      const priorWeekActiveUsers = activeUserIds({
        usageRows: usageRows14d.filter(
          (event) => event.occurredAt.getTime() < currentWeekStart.getTime(),
        ),
        ownerByProjectId,
        authenticatedUserIds,
      });
      const activatedInstallations = installationRows.filter(
        (installation) =>
          installation.activatedAt !== null && installation.revokedAt === null,
      );
      const installationsWithPack = new Set(
        usageRowsAll
          .filter((event) => event.eventType === "context_pack_created")
          .map((event) => event.installationId),
      );
      const convertedInstallations = activatedInstallations.filter(
        (installation) =>
          installationsWithPack.has(installation.installationId),
      );
      const outcomeEvents = usageRows30d.filter(
        (event) => event.eventType === "context_outcome_reported",
      );
      const failedOutcomeEvents = outcomeEvents.filter(
        (event) => event.outcome === "failed",
      );
      const packLatencies = usageRows30d
        .filter((event) => event.eventType === "context_pack_created")
        .map((event) => event.latencyMs);
      const dailyPackCount = dailyRows.reduce(
        (sum, row) => sum + row.contextPackCreatedCount,
        0,
      );

      return {
        authenticatedUsers: new Set(
          accountRows.map((account) => account.id),
        ).size,
        activatedInstallations: activatedInstallations.length,
        activeUsers7d: activeUsers7d.size,
        activeUsers30d: activeUsers30d.size,
        firstPackConversion:
          activatedInstallations.length === 0
            ? null
            : roundRatio(
                convertedInstallations.length / activatedInstallations.length,
              ),
        weeklyRetention:
          priorWeekActiveUsers.size === 0
            ? null
            : roundRatio(
                intersectionSize(activeUsers7d, priorWeekActiveUsers) /
                  priorWeekActiveUsers.size,
              ),
        packsPerActiveUser30d:
          activeUsers30d.size === 0
            ? null
            : roundRatio(dailyPackCount / activeUsers30d.size),
        clientDistribution: countBuckets(
          installationRows.map((installation) => installation.clientType),
        ),
        versionDistribution: countBuckets(
          installationRows.map((installation) => installation.packageVersion),
        ),
        privacyModeDistribution: countBuckets(
          projectRows.map((project) => project.privacyMode),
        ),
        errorRate30d:
          outcomeEvents.length === 0
            ? null
            : roundRatio(failedOutcomeEvents.length / outcomeEvents.length),
        p95LatencyMs30d: percentile95(packLatencies),
        npmDownloads,
      };
    },
  };
}

export function createAdminAnalyticsPageDataLoader(input: {
  requireAdmin: () => Promise<AuthenticatedViewer>;
  readAnalytics: (input: { now: Date }) => Promise<FounderAnalytics>;
}) {
  return async function loadAdminAnalytics(inputOptions: {
    now: Date;
  }): Promise<FounderAnalytics> {
    await input.requireAdmin();
    return input.readAnalytics({ now: inputOptions.now });
  };
}

async function readAccounts(db: AgentRailDatabase) {
  return db
    .select({
      id: accounts.id,
      userId: accounts.userId,
    })
    .from(accounts);
}

async function readInstallations(
  db: AgentRailDatabase,
): Promise<readonly InstallationRow[]> {
  return db
    .select({
      projectId: installations.projectId,
      installationId: installations.installationId,
      clientType: installations.clientType,
      packageVersion: installations.packageVersion,
      activatedAt: installations.activatedAt,
      revokedAt: installations.revokedAt,
    })
    .from(installations);
}

async function readProjects(
  db: AgentRailDatabase,
): Promise<readonly ProjectRow[]> {
  return db
    .select({
      projectId: projects.projectId,
      ownerUserId: projects.ownerUserId,
      privacyMode: projects.privacyMode,
    })
    .from(projects);
}

async function readUsageRows(
  db: AgentRailDatabase,
  input: { from?: Date; before?: Date },
): Promise<readonly UsageRow[]> {
  const filters = [];
  if (input.from !== undefined) {
    filters.push(gte(usageEvents.occurredAt, input.from));
  }
  if (input.before !== undefined) {
    filters.push(lt(usageEvents.occurredAt, input.before));
  }

  const query = db
    .select({
      projectId: usageEvents.projectId,
      installationId: usageEvents.installationId,
      eventType: usageEvents.eventType,
      occurredAt: usageEvents.occurredAt,
      latencyMs: usageEvents.latencyMs,
      outcome: usageEvents.outcome,
    })
    .from(usageEvents);

  if (filters.length === 0) {
    return query;
  }

  return query.where(and(...filters));
}

async function readDailyUsageRows(
  db: AgentRailDatabase,
  input: { fromDay: string; throughDay: string },
) {
  return db
    .select({
      day: dailyUsage.day,
      contextPackCreatedCount: dailyUsage.contextPackCreatedCount,
    })
    .from(dailyUsage)
    .where(
      and(
        gte(dailyUsage.day, input.fromDay),
        lt(dailyUsage.day, nextDateKey(input.throughDay)),
      ),
    );
}

function activeUserIds(input: {
  usageRows: readonly UsageRow[];
  ownerByProjectId: ReadonlyMap<string, string>;
  authenticatedUserIds: ReadonlySet<string>;
}): Set<string> {
  const active = new Set<string>();
  for (const event of input.usageRows) {
    if (event.eventType !== "context_pack_created") {
      continue;
    }
    const ownerUserId = input.ownerByProjectId.get(event.projectId);
    if (
      ownerUserId !== undefined &&
      input.authenticatedUserIds.has(ownerUserId)
    ) {
      active.add(ownerUserId);
    }
  }
  return active;
}

function countBuckets(labels: readonly string[]): readonly CountBucket[] {
  const counts = new Map<string, number>();
  for (const label of labels) {
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count);
}

function intersectionSize<T>(left: ReadonlySet<T>, right: ReadonlySet<T>) {
  let count = 0;
  for (const value of left) {
    if (right.has(value)) {
      count += 1;
    }
  }
  return count;
}

function percentile95(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[index] ?? null;
}

function roundRatio(value: number): number {
  return Math.round(value * 100) / 100;
}

function daysBefore(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1_000);
}

function toDateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function nextDateKey(day: string): string {
  const value = new Date(`${day}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return toDateKey(value);
}

async function readNpmDownloads(
  reader: (() => Promise<NpmDownloads>) | undefined,
): Promise<NpmDownloads> {
  if (reader !== undefined) {
    return reader();
  }
  return readCachedNpmDownloads();
}

async function readCachedNpmDownloads(): Promise<NpmDownloads> {
  const now = Date.now();
  if (npmDownloadCache !== null && npmDownloadCache.expiresAt > now) {
    return npmDownloadCache.downloads;
  }

  try {
    const response = await fetch(
      "https://api.npmjs.org/downloads/point/last-week/@agentrail-sdk%2Fsdk",
      {
        headers: {
          accept: "application/json",
        },
      },
    );
    if (!response.ok) {
      throw new Error(`npm downloads returned HTTP ${response.status}`);
    }
    const payload = (await response.json()) as {
      downloads?: unknown;
      start?: unknown;
      end?: unknown;
    };
    const downloads =
      typeof payload.downloads === "number" ? payload.downloads : null;
    const period =
      typeof payload.start === "string" && typeof payload.end === "string"
        ? `${payload.start}..${payload.end}`
        : "last-week";
    const value: NpmDownloads = {
      value: downloads,
      period,
      source: downloads === null ? "unavailable" : "npm",
    };
    npmDownloadCache = {
      expiresAt: now + NPM_DOWNLOAD_CACHE_MS,
      downloads: value,
    };
    return value;
  } catch {
    return {
      value: null,
      period: "last-week",
      source: "unavailable",
    };
  }
}
