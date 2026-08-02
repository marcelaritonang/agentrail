export { createDatabase } from "./client.js";
export type {
  AgentRailDatabase,
  DatabaseConnection,
  SqlClient,
} from "./client.js";

export { createSpanRepository } from "./span-repository.js";
export type { SpanWrite } from "./span-repository.js";
export { createControlRepository } from "./control-repository.js";
export { createReceiptRepository } from "./receipt-repository.js";
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
export type {
  EvidenceSourceWrite,
  EvidenceSourceWriteBatch,
  MemoryListInput,
  MemoryPage,
  OutcomeWrite,
  ProjectScopedMemory,
  ReceiptDetail,
  ReceiptWrite,
  SharedReceipt,
  ShareWrite,
} from "./receipt-repository.js";

export {
  accounts,
  apiKeys,
  authSchema,
  contextPacks,
  contextSources,
  dailyUsage,
  deviceCodes,
  installations,
  projects,
  projectMemories,
  outcomeReports,
  sessions,
  receipts,
  spans,
  sharedReceipts,
  traces,
  usageEvents,
  users,
  verifications,
} from "./schema.js";
export type {
  ContextOutcome,
  ContextPackStatus,
  EvidenceMode,
  EvidenceTrustClass,
  MemorySourceKind,
  MemoryStatus,
  MemoryType,
  OutcomeReasonCode,
  PayloadMode,
  PrivacyMode,
  ReceiptStatus,
  ShareReviewField,
  SpanKind,
  SpanOutcome,
  TraceCompletionState,
  UsageEventType,
  UserRole,
} from "./schema.js";
