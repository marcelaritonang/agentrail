import {
  bigserial,
  boolean,
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

export const projects = pgTable("projects", {
  projectId: uuid("project_id").primaryKey(),
  name: text("name").notNull(),
  payloadMode: text("payload_mode").$type<PayloadMode>().notNull(),
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

export const traces = pgTable(
  "traces",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.projectId, { onDelete: "cascade" }),
    traceId: varchar("trace_id", { length: 32 }).notNull(),
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
