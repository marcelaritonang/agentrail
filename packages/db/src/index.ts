export { createDatabase } from "./client.js";
export type {
  AgentRailDatabase,
  DatabaseConnection,
  SqlClient,
} from "./client.js";

export { createSpanRepository } from "./span-repository.js";
export type { SpanWrite } from "./span-repository.js";
export { createControlRepository } from "./control-repository.js";
export type {
  CanonicalUsageEvent,
  ContextPackMetricWrite,
  DailyUsageDelta,
  DeviceConsumeResult,
  InstallationAuthRecord,
  NewInstallationCredential,
  OwnedProject,
  StoredDeviceCode,
} from "./control-repository.js";

export {
  accounts,
  apiKeys,
  authSchema,
  contextPacks,
  dailyUsage,
  deviceCodes,
  installations,
  projects,
  sessions,
  spans,
  traces,
  usageEvents,
  users,
  verifications,
} from "./schema.js";
export type {
  ContextOutcome,
  ContextPackStatus,
  PayloadMode,
  PrivacyMode,
  SpanKind,
  SpanOutcome,
  TraceCompletionState,
  UsageEventType,
  UserRole,
} from "./schema.js";
