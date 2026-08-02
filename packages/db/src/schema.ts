import {
  bigserial,
  boolean,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export type PayloadMode = "none" | "redacted" | "full";
export type SpanKind =
  "trace" | "llm" | "retrieval" | "tool" | "action" | "custom";
export type SpanOutcome = "ok" | "error";
export type TraceCompletionState = "complete" | "incomplete";
export type PrivacyMode = "local-only" | "metrics-only" | "evidence-sync";
export type UserRole = "member" | "admin";
export type ContextPackStatus = "ready" | "partial" | "empty";
export type ReceiptStatus = ContextPackStatus | "failed";
export type ContextOutcome = "helpful" | "partial" | "missed" | "failed";
export type UsageEventType =
  "context_pack_created" | "context_outcome_reported";
export type MemoryType =
  | "architecture"
  | "constraint"
  | "convention"
  | "rejected_approach"
  | "risk"
  | "workaround";
export type MemoryStatus =
  | "active"
  | "superseded"
  | "expired"
  | "review_required"
  | "deleted";
export type MemorySourceKind = "explicit_tool" | "manual_dashboard" | "import";
export type EvidenceMode = "metrics_only" | "redacted_evidence";
export type EvidenceTrustClass =
  | "trusted_instruction"
  | "project_source"
  | "project_documentation"
  | "project_memory"
  | "untrusted_content";
export type OutcomeReasonCode =
  | "solved_task"
  | "missing_context"
  | "wrong_file"
  | "too_broad"
  | "tool_failure"
  | "unsafe"
  | "other";
export type ShareReviewField =
  | "summary"
  | "measurement"
  | "warnings"
  | "source_metadata"
  | "outcome";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  role: text("role").$type<UserRole>().default("member").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [index("sessions_userId_idx").on(table.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("accounts_userId_idx").on(table.userId),
    uniqueIndex("accounts_provider_account_unique").on(
      table.providerId,
      table.accountId,
    ),
  ],
);

export const verifications = pgTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [index("verifications_identifier_idx").on(table.identifier)],
);

export const authSchema = {
  users,
  sessions,
  accounts,
  verifications,
};

export const projects = pgTable("projects", {
  projectId: uuid("project_id").primaryKey(),
  name: text("name").notNull(),
  payloadMode: text("payload_mode").$type<PayloadMode>().notNull(),
  ownerUserId: text("owner_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  privacyMode: text("privacy_mode")
    .$type<PrivacyMode>()
    .default("local-only")
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
});

export const apiKeys = pgTable(
  "api_keys",
  {
    apiKeyId: uuid("api_key_id").primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.projectId, { onDelete: "cascade" }),
    keyPrefix: varchar("key_prefix", { length: 32 }).notNull(),
    keyDigest: varchar("key_digest", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    revokedAt: timestamp("revoked_at", {
      withTimezone: true,
      mode: "date",
    }),
  },
  (table) => [uniqueIndex("api_keys_prefix_unique").on(table.keyPrefix)],
);

export const deviceCodes = pgTable(
  "device_codes",
  {
    deviceCodeId: uuid("device_code_id").primaryKey(),
    deviceCodeDigest: varchar("device_code_digest", { length: 128 }).notNull(),
    userCodeDigest: varchar("user_code_digest", { length: 128 }).notNull(),
    clientType: text("client_type").$type<"codex" | "claude">().notNull(),
    packageVersion: text("package_version").notNull(),
    projectId: uuid("project_id").references(() => projects.projectId, {
      onDelete: "set null",
    }),
    approvedByUserId: text("approved_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    approvedAt: timestamp("approved_at", {
      withTimezone: true,
      mode: "date",
    }),
    consumedAt: timestamp("consumed_at", {
      withTimezone: true,
      mode: "date",
    }),
    lastPolledAt: timestamp("last_polled_at", {
      withTimezone: true,
      mode: "date",
    }),
  },
  (table) => [
    uniqueIndex("device_codes_device_code_digest_unique").on(
      table.deviceCodeDigest,
    ),
    uniqueIndex("device_codes_user_code_digest_unique").on(
      table.userCodeDigest,
    ),
  ],
);

export const installations = pgTable(
  "installations",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.projectId, { onDelete: "cascade" }),
    installationId: text("installation_id").notNull(),
    credentialPrefix: varchar("credential_prefix", { length: 32 }).notNull(),
    credentialDigest: varchar("credential_digest", { length: 128 }).notNull(),
    clientType: text("client_type").$type<"codex" | "claude">().notNull(),
    packageVersion: text("package_version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    activatedAt: timestamp("activated_at", {
      withTimezone: true,
      mode: "date",
    }),
    lastSeenAt: timestamp("last_seen_at", {
      withTimezone: true,
      mode: "date",
    }),
    revokedAt: timestamp("revoked_at", {
      withTimezone: true,
      mode: "date",
    }),
  },
  (table) => [
    uniqueIndex("installations_credential_prefix_unique").on(
      table.credentialPrefix,
    ),
    uniqueIndex("installations_project_installation_unique").on(
      table.projectId,
      table.installationId,
    ),
    index("installations_project_last_seen_idx").on(
      table.projectId,
      table.lastSeenAt,
    ),
  ],
);

export const usageEvents = pgTable(
  "usage_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.projectId, { onDelete: "cascade" }),
    installationId: text("installation_id").notNull(),
    eventId: text("event_id").notNull(),
    packId: text("pack_id").notNull(),
    eventType: text("event_type").$type<UsageEventType>().notNull(),
    occurredAt: timestamp("occurred_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    client: text("client").notNull(),
    packageVersion: text("package_version").notNull(),
    status: text("status").$type<ContextPackStatus>().notNull(),
    latencyMs: integer("latency_ms").notNull(),
    candidateTokensEstimate: integer("candidate_tokens_estimate").notNull(),
    returnedTokensEstimate: integer("returned_tokens_estimate").notNull(),
    sourceCounts: jsonb("source_counts")
      .$type<Record<string, number>>()
      .default({})
      .notNull(),
    warningCodes: jsonb("warning_codes")
      .$type<string[]>()
      .default([])
      .notNull(),
    outcome: text("outcome").$type<ContextOutcome>(),
    reasonCode: text("reason_code"),
    acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("usage_events_installation_event_unique").on(
      table.installationId,
      table.eventId,
    ),
    index("usage_events_project_occurred_idx").on(
      table.projectId,
      table.occurredAt,
    ),
  ],
);

export const contextPacks = pgTable(
  "context_packs",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.projectId, { onDelete: "cascade" }),
    packId: text("pack_id").notNull(),
    status: text("status").$type<ContextPackStatus>().notNull(),
    candidateTokensEstimate: integer("candidate_tokens_estimate").notNull(),
    returnedTokensEstimate: integer("returned_tokens_estimate").notNull(),
    sourceCounts: jsonb("source_counts")
      .$type<Record<string, number>>()
      .default({})
      .notNull(),
    warningCodes: jsonb("warning_codes")
      .$type<string[]>()
      .default([])
      .notNull(),
    outcome: text("outcome").$type<ContextOutcome>(),
    reasonCode: text("reason_code"),
    firstSeenAt: timestamp("first_seen_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    lastSeenAt: timestamp("last_seen_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.packId] }),
    index("context_packs_project_last_seen_idx").on(
      table.projectId,
      table.lastSeenAt,
    ),
  ],
);

export const dailyUsage = pgTable(
  "daily_usage",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.projectId, { onDelete: "cascade" }),
    day: date("day", { mode: "string" }).notNull(),
    contextPackCreatedCount: integer("context_pack_created_count")
      .default(0)
      .notNull(),
    contextOutcomeReportedCount: integer("context_outcome_reported_count")
      .default(0)
      .notNull(),
    candidateTokensEstimate: integer("candidate_tokens_estimate")
      .default(0)
      .notNull(),
    returnedTokensEstimate: integer("returned_tokens_estimate")
      .default(0)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("daily_usage_project_day_unique").on(
      table.projectId,
      table.day,
    ),
  ],
);

export const projectMemories = pgTable(
  "project_memories",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.projectId, { onDelete: "cascade" }),
    memoryId: text("memory_id").notNull(),
    revision: integer("revision").notNull(),
    type: text("type").$type<MemoryType>().notNull(),
    status: text("status").$type<MemoryStatus>().notNull(),
    statementRedacted: text("statement_redacted"),
    scope: text("scope").notNull(),
    sourceKind: text("source_kind").$type<MemorySourceKind>().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    tombstone: jsonb("tombstone").$type<Record<string, unknown> | null>(),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.memoryId] }),
    index("project_memories_project_status_idx").on(
      table.projectId,
      table.status,
    ),
  ],
);

export const receipts = pgTable(
  "receipts",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.projectId, { onDelete: "cascade" }),
    receiptId: text("receipt_id").notNull(),
    packId: text("pack_id").notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    status: text("status").$type<ReceiptStatus>().notNull(),
    candidateTokensEstimate: integer("candidate_tokens_estimate").notNull(),
    returnedTokensEstimate: integer("returned_tokens_estimate").notNull(),
    contextReductionEstimate: integer("context_reduction_estimate").notNull(),
    measurementMethod: text("measurement_method").notNull(),
    measurementConfidence: text("measurement_confidence").notNull(),
    sourceCount: integer("source_count").notNull(),
    warningCodes: jsonb("warning_codes")
      .$type<string[]>()
      .default([])
      .notNull(),
    evidenceMode: text("evidence_mode").$type<EvidenceMode>().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.receiptId] }),
    index("receipts_project_pack_idx").on(table.projectId, table.packId),
    index("receipts_project_created_idx").on(table.projectId, table.createdAt),
  ],
);

export const contextSources = pgTable(
  "context_sources",
  {
    projectId: uuid("project_id").notNull(),
    receiptId: text("receipt_id").notNull(),
    sourceId: text("source_id").notNull(),
    trustClass: text("trust_class").$type<EvidenceTrustClass>().notNull(),
    relativePath: text("relative_path").notNull(),
    locator: jsonb("locator")
      .$type<{
        startLine: number;
        endLine: number;
        symbol: string | null;
      }>()
      .notNull(),
    contentHash: varchar("content_hash", { length: 64 }).notNull(),
    selectionReasons: jsonb("selection_reasons")
      .$type<string[]>()
      .default([])
      .notNull(),
    excerptRedacted: text("excerpt_redacted"),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.receiptId, table.sourceId] }),
    foreignKey({
      columns: [table.projectId, table.receiptId],
      foreignColumns: [receipts.projectId, receipts.receiptId],
      name: "context_sources_receipt_fk",
    }).onDelete("cascade"),
    index("context_sources_project_receipt_idx").on(
      table.projectId,
      table.receiptId,
    ),
  ],
);

export const outcomeReports = pgTable(
  "outcome_reports",
  {
    projectId: uuid("project_id").notNull(),
    outcomeId: text("outcome_id").notNull(),
    receiptId: text("receipt_id").notNull(),
    packId: text("pack_id").notNull(),
    outcome: text("outcome").$type<ContextOutcome>().notNull(),
    reasonCode: text("reason_code").$type<OutcomeReasonCode>().notNull(),
    reportedAt: timestamp("reported_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.outcomeId] }),
    foreignKey({
      columns: [table.projectId, table.receiptId],
      foreignColumns: [receipts.projectId, receipts.receiptId],
      name: "outcome_reports_receipt_fk",
    }).onDelete("cascade"),
    index("outcome_reports_project_receipt_idx").on(
      table.projectId,
      table.receiptId,
    ),
  ],
);

export const sharedReceipts = pgTable(
  "shared_receipts",
  {
    projectId: uuid("project_id").notNull(),
    receiptId: text("receipt_id").notNull(),
    shareTokenDigest: varchar("share_token_digest", { length: 128 }).notNull(),
    fields: jsonb("fields").$type<ShareReviewField[]>().notNull(),
    reviewedAt: timestamp("reviewed_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.receiptId] }),
    uniqueIndex("shared_receipts_token_digest_unique").on(
      table.shareTokenDigest,
    ),
    foreignKey({
      columns: [table.projectId, table.receiptId],
      foreignColumns: [receipts.projectId, receipts.receiptId],
      name: "shared_receipts_receipt_fk",
    }).onDelete("cascade"),
  ],
);

export const traces = pgTable(
  "traces",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.projectId, { onDelete: "cascade" }),
    traceId: varchar("trace_id", { length: 32 }).notNull(),
    packId: text("pack_id"),
    rootSpanId: varchar("root_span_id", { length: 16 }),
    name: text("name").notNull(),
    agentId: text("agent_id").notNull(),
    onBehalfOf: text("on_behalf_of"),
    startedAt: timestamp("started_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true, mode: "date" }),
    outcome: text("outcome").$type<SpanOutcome>(),
    completionState: text("completion_state").$type<TraceCompletionState>(),
    totalCostUsd: numeric("total_cost_usd", { precision: 20, scale: 8 }),
    pricingUnknown: boolean("pricing_unknown").default(false).notNull(),
    spanCount: integer("span_count").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.traceId] }),
    index("traces_project_started_idx").on(table.projectId, table.startedAt),
    index("traces_project_pack_idx").on(table.projectId, table.packId),
  ],
);

export const spans = pgTable(
  "spans",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    projectId: uuid("project_id").notNull(),
    traceId: varchar("trace_id", { length: 32 }).notNull(),
    spanId: varchar("span_id", { length: 16 }).notNull(),
    parentSpanId: varchar("parent_span_id", { length: 16 }),
    kind: text("kind").$type<SpanKind>().notNull(),
    name: text("name").notNull(),
    agentId: text("agent_id").notNull(),
    onBehalfOf: text("on_behalf_of"),
    startedAt: timestamp("started_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    endedAt: timestamp("ended_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    outcome: text("outcome").$type<SpanOutcome>().notNull(),
    model: text("model"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    costUsd: numeric("cost_usd", { precision: 20, scale: 8 }),
    pricingUnknown: boolean("pricing_unknown").default(false).notNull(),
    pricingCatalogVersion: text("pricing_catalog_version"),
    attributes: jsonb("attributes")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    payloadRef: text("payload_ref"),
    payloadTruncated: boolean("payload_truncated").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("spans_project_span_unique").on(table.projectId, table.spanId),
    index("spans_project_trace_idx").on(table.projectId, table.traceId),
    index("spans_project_kind_started_idx").on(
      table.projectId,
      table.kind,
      table.startedAt,
    ),
    foreignKey({
      columns: [table.projectId, table.traceId],
      foreignColumns: [traces.projectId, traces.traceId],
      name: "spans_trace_fk",
    }).onDelete("cascade"),
  ],
);
