import { z } from "zod";

export const MemoryIdSchema = z.string().regex(/^mem_[A-Za-z0-9_-]{24,}$/);

export const MemoryTypeSchema = z.enum([
  "architecture",
  "constraint",
  "convention",
  "rejected_approach",
  "risk",
  "workaround",
]);

export const MemoryStatusSchema = z.enum([
  "active",
  "superseded",
  "expired",
  "review_required",
  "deleted",
]);

export const MemoryTombstoneReasonSchema = z.enum([
  "user_deleted",
  "superseded",
  "expired",
  "policy_removed",
]);

export const ProjectMemorySyncSchema = z
  .object({
    schema_version: z.literal(1),
    memory_id: MemoryIdSchema,
    revision: z.number().int().positive(),
    type: MemoryTypeSchema,
    status: MemoryStatusSchema,
    statement_redacted: z.string().min(1).max(2_000).optional(),
    scope: z.string().min(1).max(200),
    source_kind: z.enum(["explicit_tool", "manual_dashboard", "import"]),
    expires_at: z.iso.datetime().nullable(),
    updated_at: z.iso.datetime(),
    tombstone: z
      .object({
        deleted_at: z.iso.datetime(),
        reason_code: MemoryTombstoneReasonSchema,
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((memory, context) => {
    if (memory.status === "deleted") {
      if (memory.statement_redacted !== undefined) {
        context.addIssue({
          code: "custom",
          path: ["statement_redacted"],
          message: "deleted memories cannot carry a statement body",
        });
      }
      return;
    }

    if (memory.statement_redacted === undefined) {
      context.addIssue({
        code: "custom",
        path: ["statement_redacted"],
        message: "non-deleted memories require a redacted statement",
      });
    }

    if (memory.tombstone !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["tombstone"],
        message: "only deleted memories can carry a tombstone",
      });
    }
  });

export type ProjectMemorySync = z.infer<typeof ProjectMemorySyncSchema>;
