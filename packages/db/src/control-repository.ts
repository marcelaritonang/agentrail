import { createHash } from "node:crypto";

import { and, eq, isNull, sql } from "drizzle-orm";

import type { AgentRailDatabase } from "./client.js";
import {
  contextPacks,
  dailyUsage,
  deviceCodes,
  installations,
  projects,
  usageEvents,
} from "./schema.js";

export type OwnedProject = {
  projectId: string;
  ownerUserId: string;
  name: string;
  privacyMode: "local-only" | "metrics-only" | "evidence-sync";
};

export type StoredDeviceCode = {
  deviceCodeId: string;
  deviceCodeDigest: string;
  userCodeDigest: string;
  clientType: "codex" | "claude";
  packageVersion: string;
  createdAt: Date;
  expiresAt: Date;
};

export type NewInstallationCredential = {
  installationId: string;
  raw: string;
  prefix: string;
  digest: string;
};

export type DeviceConsumeResult =
  | { status: "authorization_pending" | "expired_token" | "access_denied" }
  | {
      status: "approved";
      projectId: string;
      installationId: string;
      credential: NewInstallationCredential;
    };

export type InstallationAuthRecord = {
  projectId: string;
  installationId: string;
  credentialDigest: string;
};

export type CanonicalUsageEvent = {
  projectId: string;
  installationId: string;
  eventId: string;
  packId: string;
  eventType: "context_pack_created" | "context_outcome_reported";
  occurredAt: Date;
  safeAttributes: {
    client: string;
    packageVersion: string;
    status: "ready" | "partial" | "empty";
    latencyMs: number;
    candidateTokensEstimate: number;
    returnedTokensEstimate: number;
    sourceCounts: Record<string, number>;
    warningCodes: readonly string[];
    outcome?: "helpful" | "partial" | "missed" | "failed";
    reasonCode?: string;
  };
};

export type ContextPackMetricWrite = {
  projectId: string;
  packId: string;
  status: "ready" | "partial" | "empty";
  candidateTokensEstimate: number;
  returnedTokensEstimate: number;
  sourceCounts: Record<string, number>;
  warningCodes: readonly string[];
  occurredAt: Date;
  outcome?: "helpful" | "partial" | "missed" | "failed";
  reasonCode?: string;
};

export type DailyUsageDelta = {
  projectId: string;
  day: string;
  eventType: "context_pack_created" | "context_outcome_reported";
  candidateTokensEstimate: number;
  returnedTokensEstimate: number;
};

export function createControlRepository(db: AgentRailDatabase) {
  return {
    async getOrCreateDefaultProject(userId: string): Promise<OwnedProject> {
      const projectId = defaultProjectIdForUser(userId);

      await db
        .insert(projects)
        .values({
          projectId,
          name: "Default project",
          payloadMode: "redacted",
          ownerUserId: userId,
          privacyMode: "metrics-only",
        })
        .onConflictDoNothing({ target: projects.projectId });

      const [project] = await db
        .select({
          projectId: projects.projectId,
          ownerUserId: projects.ownerUserId,
          name: projects.name,
          privacyMode: projects.privacyMode,
        })
        .from(projects)
        .where(eq(projects.projectId, projectId))
        .limit(1);

      if (!project || project.ownerUserId !== userId) {
        throw new Error("Default project could not be resolved.");
      }

      return {
        projectId: project.projectId,
        ownerUserId: project.ownerUserId,
        name: project.name,
        privacyMode: project.privacyMode,
      };
    },

    async issueDeviceCode(input: StoredDeviceCode): Promise<void> {
      await db.insert(deviceCodes).values({
        deviceCodeId: input.deviceCodeId,
        deviceCodeDigest: input.deviceCodeDigest,
        userCodeDigest: input.userCodeDigest,
        clientType: input.clientType,
        packageVersion: input.packageVersion,
        createdAt: input.createdAt,
        expiresAt: input.expiresAt,
      });
    },

    async approveDeviceCode(input: {
      userCodeDigest: string;
      userId: string;
      projectId: string;
      now: Date;
    }): Promise<"approved" | "expired" | "already_approved" | "not_found"> {
      const [ownedProject] = await db
        .select({ projectId: projects.projectId })
        .from(projects)
        .where(
          and(
            eq(projects.projectId, input.projectId),
            eq(projects.ownerUserId, input.userId),
          ),
        )
        .limit(1);

      if (!ownedProject) {
        return "not_found";
      }

      const [code] = await db
        .select()
        .from(deviceCodes)
        .where(eq(deviceCodes.userCodeDigest, input.userCodeDigest))
        .limit(1);

      if (!code) {
        return "not_found";
      }
      if (code.expiresAt.getTime() <= input.now.getTime()) {
        return "expired";
      }
      if (code.approvedAt !== null) {
        return "already_approved";
      }

      const updated = await db
        .update(deviceCodes)
        .set({
          approvedAt: input.now,
          approvedByUserId: input.userId,
          projectId: input.projectId,
        })
        .where(
          and(
            eq(deviceCodes.userCodeDigest, input.userCodeDigest),
            isNull(deviceCodes.approvedAt),
          ),
        )
        .returning({ deviceCodeId: deviceCodes.deviceCodeId });

      return updated.length === 0 ? "already_approved" : "approved";
    },

    async consumeApprovedDeviceCode(input: {
      deviceCodeDigest: string;
      now: Date;
      credential: NewInstallationCredential;
    }): Promise<DeviceConsumeResult> {
      return db.transaction(async (transaction) => {
        const [code] = await transaction
          .select()
          .from(deviceCodes)
          .where(eq(deviceCodes.deviceCodeDigest, input.deviceCodeDigest))
          .limit(1);

        if (!code) {
          return { status: "access_denied" };
        }
        if (code.expiresAt.getTime() <= input.now.getTime()) {
          return { status: "expired_token" };
        }
        if (code.approvedAt === null || code.projectId === null) {
          return { status: "authorization_pending" };
        }
        if (code.consumedAt !== null) {
          return { status: "access_denied" };
        }

        const consumed = await transaction
          .update(deviceCodes)
          .set({ consumedAt: input.now })
          .where(
            and(
              eq(deviceCodes.deviceCodeDigest, input.deviceCodeDigest),
              isNull(deviceCodes.consumedAt),
            ),
          )
          .returning({
            projectId: deviceCodes.projectId,
            clientType: deviceCodes.clientType,
            packageVersion: deviceCodes.packageVersion,
          });

        const consumedCode = consumed[0];
        if (!consumedCode?.projectId) {
          return { status: "access_denied" };
        }

        await transaction.insert(installations).values({
          projectId: consumedCode.projectId,
          installationId: input.credential.installationId,
          credentialPrefix: input.credential.prefix,
          credentialDigest: input.credential.digest,
          clientType: consumedCode.clientType,
          packageVersion: consumedCode.packageVersion,
          createdAt: input.now,
        });

        return {
          status: "approved",
          projectId: consumedCode.projectId,
          installationId: input.credential.installationId,
          credential: input.credential,
        };
      });
    },

    async findActiveInstallationByPrefix(
      prefix: string,
    ): Promise<InstallationAuthRecord | null> {
      const [record] = await db
        .select({
          projectId: installations.projectId,
          installationId: installations.installationId,
          credentialDigest: installations.credentialDigest,
        })
        .from(installations)
        .where(
          and(
            eq(installations.credentialPrefix, prefix),
            isNull(installations.revokedAt),
          ),
        )
        .limit(1);

      return record ?? null;
    },

    async revokeInstallation(input: {
      installationId: string;
      ownerUserId: string;
    }): Promise<boolean> {
      const [record] = await db
        .select({ id: installations.id })
        .from(installations)
        .innerJoin(projects, eq(projects.projectId, installations.projectId))
        .where(
          and(
            eq(installations.installationId, input.installationId),
            eq(projects.ownerUserId, input.ownerUserId),
            isNull(installations.revokedAt),
          ),
        )
        .limit(1);

      if (!record) {
        return false;
      }

      await db
        .update(installations)
        .set({ revokedAt: new Date() })
        .where(eq(installations.id, record.id));

      return true;
    },

    async insertUsageEvent(
      input: CanonicalUsageEvent,
    ): Promise<"inserted" | "duplicate"> {
      const inserted = await db
        .insert(usageEvents)
        .values({
          projectId: input.projectId,
          installationId: input.installationId,
          eventId: input.eventId,
          packId: input.packId,
          eventType: input.eventType,
          occurredAt: input.occurredAt,
          client: input.safeAttributes.client,
          packageVersion: input.safeAttributes.packageVersion,
          status: input.safeAttributes.status,
          latencyMs: input.safeAttributes.latencyMs,
          candidateTokensEstimate: input.safeAttributes.candidateTokensEstimate,
          returnedTokensEstimate: input.safeAttributes.returnedTokensEstimate,
          sourceCounts: input.safeAttributes.sourceCounts,
          warningCodes: [...input.safeAttributes.warningCodes],
          outcome: input.safeAttributes.outcome ?? null,
          reasonCode: input.safeAttributes.reasonCode ?? null,
        })
        .onConflictDoNothing({
          target: [usageEvents.installationId, usageEvents.eventId],
        })
        .returning({ id: usageEvents.id });

      return inserted.length === 0 ? "duplicate" : "inserted";
    },

    async upsertContextPack(input: ContextPackMetricWrite): Promise<void> {
      await db
        .insert(contextPacks)
        .values({
          projectId: input.projectId,
          packId: input.packId,
          status: input.status,
          candidateTokensEstimate: input.candidateTokensEstimate,
          returnedTokensEstimate: input.returnedTokensEstimate,
          sourceCounts: input.sourceCounts,
          warningCodes: [...input.warningCodes],
          outcome: input.outcome ?? null,
          reasonCode: input.reasonCode ?? null,
          firstSeenAt: input.occurredAt,
          lastSeenAt: input.occurredAt,
        })
        .onConflictDoUpdate({
          target: [contextPacks.projectId, contextPacks.packId],
          set: {
            status: input.status,
            candidateTokensEstimate: input.candidateTokensEstimate,
            returnedTokensEstimate: input.returnedTokensEstimate,
            sourceCounts: input.sourceCounts,
            warningCodes: [...input.warningCodes],
            outcome: input.outcome ?? null,
            reasonCode: input.reasonCode ?? null,
            lastSeenAt: input.occurredAt,
          },
        });
    },

    async incrementDailyUsage(input: DailyUsageDelta): Promise<void> {
      const createdDelta = input.eventType === "context_pack_created" ? 1 : 0;
      const outcomeDelta =
        input.eventType === "context_outcome_reported" ? 1 : 0;

      await db
        .insert(dailyUsage)
        .values({
          projectId: input.projectId,
          day: input.day,
          contextPackCreatedCount: createdDelta,
          contextOutcomeReportedCount: outcomeDelta,
          candidateTokensEstimate: input.candidateTokensEstimate,
          returnedTokensEstimate: input.returnedTokensEstimate,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [dailyUsage.projectId, dailyUsage.day],
          set: {
            contextPackCreatedCount: sql`${dailyUsage.contextPackCreatedCount} + ${createdDelta}`,
            contextOutcomeReportedCount: sql`${dailyUsage.contextOutcomeReportedCount} + ${outcomeDelta}`,
            candidateTokensEstimate: sql`${dailyUsage.candidateTokensEstimate} + ${input.candidateTokensEstimate}`,
            returnedTokensEstimate: sql`${dailyUsage.returnedTokensEstimate} + ${input.returnedTokensEstimate}`,
            updatedAt: new Date(),
          },
        });
    },
  };
}

function defaultProjectIdForUser(userId: string): string {
  const hex = createHash("sha256")
    .update(`agentrail:default-project:${userId}`)
    .digest("hex");
  const variant = ((Number.parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80)
    .toString(16)
    .padStart(2, "0");

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `${variant}${hex.slice(18, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}
