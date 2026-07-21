export { createDatabase } from "./client.js";
export type {
  AgentRailDatabase,
  DatabaseConnection,
  SqlClient,
} from "./client.js";

export { createSpanRepository } from "./span-repository.js";
export type { SpanWrite } from "./span-repository.js";

export { apiKeys, projects, spans, traces } from "./schema.js";
export type {
  PayloadMode,
  SpanKind,
  SpanOutcome,
  TraceCompletionState,
} from "./schema.js";
