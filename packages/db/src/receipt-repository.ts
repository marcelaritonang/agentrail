import { and, eq, isNull, sql } from "drizzle-orm";

import type { AgentRailDatabase } from "./client.js";
import {
  contextSources,
  outcomeReports,
  projectMemories,
  receipts,
  sharedReceipts,
  type ContextOutcome,
  type EvidenceMode,
  type EvidenceTrustClass,
  type MemorySourceKind,
  type MemoryStatus,
  type MemoryType,
  type OutcomeReasonCode,
  type ReceiptStatus,
  type ShareReviewField,
} from "./schema.js";

export type ProjectScopedMemory = {
  projectId: string;
  memoryId: string;
  revision: number;
  type: MemoryType;
  status: MemoryStatus;
  statementRedacted: string | null;
  scope: string;
  sourceKind: MemorySourceKind;
  expiresAt: Date | null;
  updatedAt: Date;
  tombstone: Record<string, unknown> | null;
};

export type MemoryListInput = {
  projectId: string;
  status?: MemoryStatus;
  limit?: number;
};

export type MemoryPage = {
  memories: ProjectScopedMemory[];
};

export type ReceiptWrite = {
  projectId: string;
  receiptId: string;
  packId: string;
  createdAt: Date;
  status: ReceiptStatus;
  candidateTokensEstimate: number;
  returnedTokensEstimate: number;
  contextReductionEstimate: number;
  measurementMethod: "heuristic-v1";
  measurementConfidence: "estimated";
  sourceCount: number;
  warningCodes: readonly string[];
  evidenceMode: EvidenceMode;
};

export type EvidenceSourceWrite = {
  sourceId: string;
  trustClass: EvidenceTrustClass;
  relativePath: string;
  locator: {
    startLine: number;
    endLine: number;
    symbol: string | null;
  };
  contentHash: string;
  selectionReasons: readonly string[];
  excerptRedacted: string | null;
};

export type EvidenceSourceWriteBatch = {
  projectId: string;
  receiptId: string;
  sources: readonly EvidenceSourceWrite[];
};

export type ReceiptDetail = ReceiptWrite & {
  sources: EvidenceSourceWrite[];
};

export type OutcomeWrite = {
  projectId: string;
  outcomeId: string;
  receiptId: string;
  packId: string;
  outcome: ContextOutcome;
  reasonCode: OutcomeReasonCode;
  reportedAt: Date;
};

export type ShareWrite = {
  projectId: string;
  receiptId: string;
  shareTokenDigest: string;
  fields: readonly ShareReviewField[];
  reviewedAt: Date;
  expiresAt: Date;
};

export type SharedReceipt = {
  projectId: string;
  receiptId: string;
  shareTokenDigest: string;
  fields: ShareReviewField[];
  reviewedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
};

export function createReceiptRepository(db: AgentRailDatabase) {
  return {
    async upsertMemory(
      input: ProjectScopedMemory,
    ): Promise<
      | { status: "stored"; revision: number }
      | { status: "conflict"; currentRevision: number }
    > {
      const [existing] = await db
        .select({ revision: projectMemories.revision })
        .from(projectMemories)
        .where(
          and(
            eq(projectMemories.projectId, input.projectId),
            eq(projectMemories.memoryId, input.memoryId),
          ),
        )
        .limit(1);

      if (existing && input.revision <= existing.revision) {
        return { status: "conflict", currentRevision: existing.revision };
      }

      await db
        .insert(projectMemories)
        .values({
          projectId: input.projectId,
          memoryId: input.memoryId,
          revision: input.revision,
          type: input.type,
          status: input.status,
          statementRedacted: input.statementRedacted,
          scope: input.scope,
          sourceKind: input.sourceKind,
          expiresAt: input.expiresAt,
          updatedAt: input.updatedAt,
          tombstone: input.tombstone,
        })
        .onConflictDoUpdate({
          target: [projectMemories.projectId, projectMemories.memoryId],
          set: {
            revision: input.revision,
            type: input.type,
            status: input.status,
            statementRedacted: input.statementRedacted,
            scope: input.scope,
            sourceKind: input.sourceKind,
            expiresAt: input.expiresAt,
            updatedAt: input.updatedAt,
            tombstone: input.tombstone,
          },
        });

      return { status: "stored", revision: input.revision };
    },

    async listMemories(input: MemoryListInput): Promise<MemoryPage> {
      const filters = [eq(projectMemories.projectId, input.projectId)];
      if (input.status) {
        filters.push(eq(projectMemories.status, input.status));
      }

      const rows = await db
        .select()
        .from(projectMemories)
        .where(and(...filters))
        .limit(input.limit ?? 50);

      return {
        memories: rows.map((row) => ({
          projectId: row.projectId,
          memoryId: row.memoryId,
          revision: row.revision,
          type: row.type,
          status: row.status,
          statementRedacted: row.statementRedacted,
          scope: row.scope,
          sourceKind: row.sourceKind,
          expiresAt: row.expiresAt,
          updatedAt: row.updatedAt,
          tombstone: row.tombstone ?? null,
        })),
      };
    },

    async upsertReceipt(input: ReceiptWrite): Promise<void> {
      await db
        .insert(receipts)
        .values({
          projectId: input.projectId,
          receiptId: input.receiptId,
          packId: input.packId,
          createdAt: input.createdAt,
          status: input.status,
          candidateTokensEstimate: input.candidateTokensEstimate,
          returnedTokensEstimate: input.returnedTokensEstimate,
          contextReductionEstimate: input.contextReductionEstimate,
          measurementMethod: input.measurementMethod,
          measurementConfidence: input.measurementConfidence,
          sourceCount: input.sourceCount,
          warningCodes: [...input.warningCodes],
          evidenceMode: input.evidenceMode,
        })
        .onConflictDoUpdate({
          target: [receipts.projectId, receipts.receiptId],
          set: {
            packId: input.packId,
            createdAt: input.createdAt,
            status: input.status,
            candidateTokensEstimate: input.candidateTokensEstimate,
            returnedTokensEstimate: input.returnedTokensEstimate,
            contextReductionEstimate: input.contextReductionEstimate,
            measurementMethod: input.measurementMethod,
            measurementConfidence: input.measurementConfidence,
            sourceCount: input.sourceCount,
            warningCodes: [...input.warningCodes],
            evidenceMode: input.evidenceMode,
          },
        });
    },

    async replaceContextSources(
      input: EvidenceSourceWriteBatch,
    ): Promise<void> {
      await db.transaction(async (transaction) => {
        await transaction
          .delete(contextSources)
          .where(
            and(
              eq(contextSources.projectId, input.projectId),
              eq(contextSources.receiptId, input.receiptId),
            ),
          );

        if (input.sources.length === 0) {
          return;
        }

        await transaction.insert(contextSources).values(
          input.sources.map((source) => ({
            projectId: input.projectId,
            receiptId: input.receiptId,
            sourceId: source.sourceId,
            trustClass: source.trustClass,
            relativePath: source.relativePath,
            locator: source.locator,
            contentHash: source.contentHash,
            selectionReasons: [...source.selectionReasons],
            excerptRedacted: source.excerptRedacted,
          })),
        );
      });
    },

    async getReceipt(input: {
      projectId: string;
      receiptId: string;
    }): Promise<ReceiptDetail | null> {
      const [receipt] = await db
        .select()
        .from(receipts)
        .where(
          and(
            eq(receipts.projectId, input.projectId),
            eq(receipts.receiptId, input.receiptId),
          ),
        )
        .limit(1);

      if (!receipt) {
        return null;
      }

      const sources = await db
        .select()
        .from(contextSources)
        .where(
          and(
            eq(contextSources.projectId, input.projectId),
            eq(contextSources.receiptId, input.receiptId),
          ),
        );

      return {
        projectId: receipt.projectId,
        receiptId: receipt.receiptId,
        packId: receipt.packId,
        createdAt: receipt.createdAt,
        status: receipt.status,
        candidateTokensEstimate: receipt.candidateTokensEstimate,
        returnedTokensEstimate: receipt.returnedTokensEstimate,
        contextReductionEstimate: receipt.contextReductionEstimate,
        measurementMethod: "heuristic-v1",
        measurementConfidence: "estimated",
        sourceCount: receipt.sourceCount,
        warningCodes: receipt.warningCodes,
        evidenceMode: receipt.evidenceMode,
        sources: sources.map((source) => ({
          sourceId: source.sourceId,
          trustClass: source.trustClass,
          relativePath: source.relativePath,
          locator: source.locator,
          contentHash: source.contentHash,
          selectionReasons: source.selectionReasons,
          excerptRedacted: source.excerptRedacted,
        })),
      };
    },

    async insertOutcome(input: OutcomeWrite): Promise<"inserted" | "duplicate"> {
      const inserted = await db
        .insert(outcomeReports)
        .values({
          projectId: input.projectId,
          outcomeId: input.outcomeId,
          receiptId: input.receiptId,
          packId: input.packId,
          outcome: input.outcome,
          reasonCode: input.reasonCode,
          reportedAt: input.reportedAt,
        })
        .onConflictDoNothing({
          target: [outcomeReports.projectId, outcomeReports.outcomeId],
        })
        .returning({ outcomeId: outcomeReports.outcomeId });

      return inserted.length === 0 ? "duplicate" : "inserted";
    },

    async createShare(input: ShareWrite): Promise<void> {
      await db
        .insert(sharedReceipts)
        .values({
          projectId: input.projectId,
          receiptId: input.receiptId,
          shareTokenDigest: input.shareTokenDigest,
          fields: [...input.fields],
          reviewedAt: input.reviewedAt,
          expiresAt: input.expiresAt,
        })
        .onConflictDoUpdate({
          target: [sharedReceipts.projectId, sharedReceipts.receiptId],
          set: {
            shareTokenDigest: input.shareTokenDigest,
            fields: [...input.fields],
            reviewedAt: input.reviewedAt,
            expiresAt: input.expiresAt,
            revokedAt: null,
            createdAt: sql`now()`,
          },
        });
    },

    async revokeShare(input: {
      projectId: string;
      receiptId: string;
    }): Promise<boolean> {
      const updated = await db
        .update(sharedReceipts)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(sharedReceipts.projectId, input.projectId),
            eq(sharedReceipts.receiptId, input.receiptId),
            isNull(sharedReceipts.revokedAt),
          ),
        )
        .returning({ receiptId: sharedReceipts.receiptId });

      return updated.length > 0;
    },

    async getSharedReceiptByDigest(
      digest: string,
    ): Promise<SharedReceipt | null> {
      const [share] = await db
        .select()
        .from(sharedReceipts)
        .where(
          and(
            eq(sharedReceipts.shareTokenDigest, digest),
            isNull(sharedReceipts.revokedAt),
          ),
        )
        .limit(1);

      if (!share) {
        return null;
      }

      return {
        projectId: share.projectId,
        receiptId: share.receiptId,
        shareTokenDigest: share.shareTokenDigest,
        fields: share.fields,
        reviewedAt: share.reviewedAt,
        expiresAt: share.expiresAt,
        revokedAt: share.revokedAt,
      };
    },
  };
}
