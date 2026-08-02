import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { UsageEvent } from "@agentrail-sdk/contracts";

import { chunkTextFile, type SourceChunk } from "./chunker.js";
import { scanWorkspace } from "./scanner.js";
import {
  createFileUsageSpool,
  createUsageFlushScheduler,
  readRestrictedFileCredential,
  type UsageFlushScheduler,
  type UsageSpool,
} from "./spool-flush.js";
import { estimateTokens } from "./tokens.js";
import {
  ContextPackRequestSchema,
  type ContextItem,
  type ContextLocalEvidence,
  type ContextPack,
  type ContextPackRequest,
  type ProjectMemoryRecord,
} from "./types.js";
import { createFileMemoryStore, type LocalMemory } from "./memory.js";
import { resolveWorkspaceRoot } from "./workspace.js";

export type ContextRelayOptions = {
  workspaceRoot: string;
  privacyMode: "local-only" | "metrics-only" | "evidence-sync";
  client: string;
  packageVersion: string;
  installationId?: string;
  apiUrl?: string;
  dashboardUrl?: string;
  credential?: string;
  usageSpool?: UsageSpool;
  fetch?: typeof fetch;
  now?: () => Date;
};

export type RecallRequest = {
  query?: string;
  tags?: readonly string[];
  limit?: number;
};

export type RememberRequest = {
  statement: string;
  type?: LocalMemory["type"];
  scope?: string;
  expiresAt?: string | null;
  tags?: readonly string[];
};

export type OutcomeRequest = {
  packId: string;
  outcome: "accepted" | "rejected" | "changed" | "unknown";
  reason?: string;
};

export type LocalContextReceipt = {
  receiptId: string;
  packId: string;
  recordedAt: string;
  outcome: OutcomeRequest["outcome"];
  reason: string | null;
};

export type ContextRelay = {
  prepareContext(request: ContextPackRequest): Promise<ContextPack>;
  recall(input: RecallRequest): Promise<readonly ProjectMemoryRecord[]>;
  remember(input: RememberRequest): Promise<ProjectMemoryRecord>;
  reportOutcome(input: OutcomeRequest): Promise<LocalContextReceipt>;
};

export function createContextRelay(options: ContextRelayOptions): ContextRelay {
  const now = options.now ?? (() => new Date());
  let usageFlushScheduler: UsageFlushScheduler | null = null;

  return {
    async prepareContext(request) {
      const startTimeMs = Date.now();
      const parsedRequest = ContextPackRequestSchema.parse(request);
      const root = await resolveWorkspaceRoot(options.workspaceRoot);
      const scan = await scanWorkspace({
        root,
        ...(parsedRequest.exclude === undefined
          ? {}
          : { exclude: parsedRequest.exclude }),
      });
      const chunks = await chunksFromFiles(scan.files);
      const rankedChunks = rankChunks({
        chunks,
        task: parsedRequest.task,
        focus: parsedRequest.focus ?? [],
      });
      const decisions = await recallMemory({
        root,
        input: {
          query: parsedRequest.task,
          ...(parsedRequest.focus === undefined
            ? {}
            : { tags: parsedRequest.focus }),
          limit: 5,
        },
      });
      const context = budgetChunks(rankedChunks, parsedRequest.tokenBudget);
      const returnedTokensEstimate =
        context.reduce((total, item) => total + item.estimatedTokens, 0) +
        decisions.reduce(
          (total, decision) => total + estimateTokens(decision.statement),
          0,
        );
      const candidateTokensEstimate = chunks.reduce(
        (total, chunk) => total + chunk.estimatedTokens,
        0,
      );
      const packId = sha256(
        `${parsedRequest.task}:${now().toISOString()}:${randomUUID()}`,
      );
      const stablePackId = `cp_${packId.slice(0, 32)}`;
      await writeLocalReceipt(root, {
        packId: stablePackId,
        requestedAt: now().toISOString(),
        request: parsedRequest,
        context,
        decisions,
        warnings: scan.warnings,
        client: options.client,
        packageVersion: options.packageVersion,
        privacyMode: options.privacyMode,
      });

      const pack: ContextPack = {
        packId: stablePackId,
        status:
          context.length === 0 ? "empty" : scan.complete ? "ready" : "partial",
        context,
        decisions,
        warnings: scan.warnings,
        measurement: {
          candidateTokensEstimate,
          returnedTokensEstimate,
          contextReductionEstimate:
            candidateTokensEstimate === 0
              ? 0
              : Math.max(
                  0,
                  Math.round(
                    (1 - returnedTokensEstimate / candidateTokensEstimate) *
                      100,
                  ),
                ),
          method: "heuristic-v1",
          confidence: "estimated",
        },
        localEvidence: localEvidenceFor(stablePackId, decisions.length),
        receiptUrl: null,
      };
      await recordUsageEvent({
        root,
        pack,
        event: {
          eventType: "context_pack_created",
          latencyMs: Math.max(0, Date.now() - startTimeMs),
        },
        options,
        scheduler: () => usageFlushScheduler,
        setScheduler: (scheduler) => {
          usageFlushScheduler = scheduler;
        },
        now,
      });
      return pack;
    },
    recall(input) {
      return recallMemory({
        root: options.workspaceRoot,
        input,
      });
    },
    async remember(input) {
      const root = await resolveWorkspaceRoot(options.workspaceRoot);
      const tags = normalizeTags(input.tags);
      const store = await createFileMemoryStore({ root, now });
      const memory = await store.remember({
        memoryId: `mem_${sha256(`${input.statement}:${now().toISOString()}:${randomUUID()}`).slice(0, 32)}`,
        statement: boundedString(input.statement, 2_000, "statement"),
        type: input.type ?? memoryTypeFromTags(tags),
        scope:
          input.scope === undefined
            ? memoryScopeFromTags(tags)
            : boundedString(input.scope, 200, "scope"),
        expiresAt: input.expiresAt ?? null,
      });
      return projectMemoryRecordFromLocal(memory);
    },
    async reportOutcome(input) {
      const root = await resolveWorkspaceRoot(options.workspaceRoot);
      const receipt: LocalContextReceipt = {
        receiptId: sha256(
          `${input.packId}:${input.outcome}:${now().toISOString()}:${randomUUID()}`,
        ),
        packId: boundedString(input.packId, 200, "packId"),
        recordedAt: now().toISOString(),
        outcome: input.outcome,
        reason:
          input.reason === undefined
            ? null
            : boundedString(input.reason, 1_000, "reason"),
      };
      await appendJsonLine(outcomePath(root), receipt);
      await recordUsageEvent({
        root,
        pack: {
          packId: receipt.packId,
          status: "ready",
          context: [],
          decisions: [],
          warnings: [],
          measurement: {
            candidateTokensEstimate: 0,
            returnedTokensEstimate: 0,
            contextReductionEstimate: 0,
            method: "heuristic-v1",
            confidence: "estimated",
          },
          localEvidence: localEvidenceFor(receipt.packId, 0),
          receiptUrl: null,
        },
        event: {
          eventType: "context_outcome_reported",
          latencyMs: 0,
          outcome: mapOutcome(input.outcome),
          reasonCode: input.reason ?? input.outcome,
        },
        options,
        scheduler: () => usageFlushScheduler,
        setScheduler: (scheduler) => {
          usageFlushScheduler = scheduler;
        },
        now,
      });
      return receipt;
    },
  };
}

async function recordUsageEvent(input: {
  root: string;
  pack: ContextPack;
  event: {
    eventType: UsageEvent["event_type"];
    latencyMs: number;
    outcome?: NonNullable<UsageEvent["safe_attributes"]["outcome"]>;
    reasonCode?: string;
  };
  options: ContextRelayOptions;
  scheduler: () => UsageFlushScheduler | null;
  setScheduler: (scheduler: UsageFlushScheduler) => void;
  now: () => Date;
}): Promise<void> {
  if (
    input.options.privacyMode === "local-only" ||
    input.options.installationId === undefined
  ) {
    return;
  }

  const spool = input.options.usageSpool ?? createFileUsageSpool(input.root);
  const event: UsageEvent = {
    schema_version: 1,
    event_id: `ev_${randomUUID().replaceAll("-", "")}`,
    pack_id: input.pack.packId,
    event_type: input.event.eventType,
    occurred_at: input.now().toISOString(),
    safe_attributes: {
      client: input.options.client,
      package_version: input.options.packageVersion,
      status: input.pack.status,
      latency_ms: input.event.latencyMs,
      candidate_tokens_estimate: input.pack.measurement.candidateTokensEstimate,
      returned_tokens_estimate: input.pack.measurement.returnedTokensEstimate,
      source_counts: sourceCountsFor(input.pack.context),
      warning_codes: input.pack.warnings.map((warning) => warning.code),
      ...(input.event.outcome === undefined
        ? {}
        : { outcome: input.event.outcome }),
      ...(input.event.reasonCode === undefined
        ? {}
        : { reason_code: input.event.reasonCode.slice(0, 50) }),
    },
  };
  await spool.append(event);

  const apiUrl = input.options.apiUrl ?? input.options.dashboardUrl;
  if (apiUrl === undefined) return;

  const credential =
    input.options.credential ??
    (await readRestrictedFileCredential({ root: input.root }));
  if (credential === null) return;

  let scheduler = input.scheduler();
  if (scheduler === null) {
    scheduler = createUsageFlushScheduler({
      spool,
      endpoint: new URL("/v1/events", apiUrl),
      credential,
      fetch: input.options.fetch ?? fetch,
      now: input.now,
    });
    input.setScheduler(scheduler);
  }
  scheduler.schedule();
}

async function chunksFromFiles(
  files: readonly {
    relativePath: string;
    absolutePath: string;
    trust: SourceChunk["trust"];
    modifiedAt: string;
  }[],
): Promise<SourceChunk[]> {
  const chunks: SourceChunk[] = [];
  for (const file of files) {
    const text = await readFile(file.absolutePath, "utf8");
    chunks.push(
      ...chunkTextFile({
        relativePath: file.relativePath,
        text,
        trust: file.trust,
        modifiedAt: file.modifiedAt,
      }),
    );
  }
  return chunks;
}

function rankChunks(input: {
  chunks: readonly SourceChunk[];
  task: string;
  focus: readonly string[];
}): SourceChunk[] {
  const terms = tokenize(`${input.task} ${input.focus.join(" ")}`);
  return [...input.chunks].sort((left, right) => {
    const leftScore = scoreChunk(left, terms);
    const rightScore = scoreChunk(right, terms);
    return (
      rightScore - leftScore ||
      trustWeight(right.trust) - trustWeight(left.trust) ||
      left.relativePath.localeCompare(right.relativePath) ||
      left.startLine - right.startLine
    );
  });
}

function budgetChunks(
  chunks: readonly SourceChunk[],
  tokenBudget: number,
): ContextItem[] {
  const items: ContextItem[] = [];
  let remaining = tokenBudget;
  for (const chunk of chunks) {
    if (chunk.estimatedTokens > remaining) continue;
    const reasons = reasonsForChunk(chunk);
    items.push({
      sourceId: chunk.sourceId,
      path: chunk.relativePath,
      locator: {
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        symbol: chunk.symbol,
      },
      content: chunk.text,
      contentHash: chunk.contentHash,
      trust: chunk.trust,
      reasons,
      score: reasons.length + trustWeight(chunk.trust),
      freshness: chunk.modifiedAt,
      estimatedTokens: chunk.estimatedTokens,
      truncated: false,
    });
    remaining -= chunk.estimatedTokens;
  }
  return items;
}

function reasonsForChunk(chunk: SourceChunk): readonly string[] {
  const reasons = [`${chunk.trust} source`];
  if (chunk.symbol !== null) reasons.push(`symbol:${chunk.symbol}`);
  return reasons;
}

async function recallMemory(input: {
  root: string;
  input: RecallRequest;
}): Promise<readonly ProjectMemoryRecord[]> {
  const root = await resolveWorkspaceRoot(input.root);
  const store = await createFileMemoryStore({ root });
  const localRecords = store.list().map(projectMemoryRecordFromLocal);
  const legacyRecords = await readJsonLines<ProjectMemoryRecord>(
    legacyMemoryPath(root),
  );
  const records = [...localRecords, ...legacyRecords];
  const terms = tokenize(
    `${input.input.query ?? ""} ${(input.input.tags ?? []).join(" ")}`,
  );
  const tags = new Set(
    (input.input.tags ?? []).map((tag) => tag.toLowerCase()),
  );
  const limit = Math.max(1, Math.min(25, Math.floor(input.input.limit ?? 10)));

  return records
    .filter((record) => record.statement.trim().length > 0)
    .map((record) => ({
      record,
      score:
        scoreText(record.statement, terms) +
        record.tags.filter((tag) => tags.has(tag.toLowerCase())).length * 3,
    }))
    .filter((entry) => terms.length === 0 || entry.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.record.recordedAt.localeCompare(left.record.recordedAt),
    )
    .slice(0, limit)
    .map((entry) => entry.record);
}

async function writeLocalReceipt(
  root: string,
  receipt: Record<string, unknown>,
): Promise<void> {
  const directory = resolve(root, ".agentrail", "receipts", "v1");
  await mkdir(directory, { recursive: true });
  const packId = String(receipt.packId ?? "unknown");
  await writeFile(
    resolve(directory, `${packId}.json`),
    `${JSON.stringify(receipt, null, 2)}\n`,
  );
}

function localEvidenceFor(
  packId: string,
  recordsUsed: number,
): ContextLocalEvidence {
  return {
    memory: {
      path: ".agentrail/memory/v2.json",
      recordsUsed,
      uploaded: false,
    },
    receipt: {
      path: `.agentrail/receipts/v1/${packId}.json`,
      url: null,
      uploaded: false,
    },
  };
}

async function appendJsonLine(path: string, value: unknown): Promise<void> {
  await mkdir(resolve(path, ".."), { recursive: true });
  await writeFile(path, `${JSON.stringify(value)}\n`, { flag: "a" });
}

async function readJsonLines<T>(path: string): Promise<T[]> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch {
    return [];
  }
  return text
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as T];
      } catch {
        return [];
      }
    });
}

function legacyMemoryPath(root: string): string {
  return resolve(root, ".agentrail", "memory", "v1.jsonl");
}

function outcomePath(root: string): string {
  return resolve(root, ".agentrail", "receipts", "outcomes.v1.jsonl");
}

function boundedString(input: string, max: number, field: string): string {
  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed.length > max) {
    throw new Error(`${field} must be between 1 and ${max} characters.`);
  }
  return trimmed;
}

function normalizeTags(tags: readonly string[] | undefined): readonly string[] {
  if (tags === undefined) return [];
  return tags
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag.length > 0)
    .slice(0, 20);
}

function memoryTypeFromTags(tags: readonly string[]): LocalMemory["type"] {
  for (const tag of tags) {
    if (
      tag === "architecture" ||
      tag === "constraint" ||
      tag === "convention" ||
      tag === "rejected_approach" ||
      tag === "risk" ||
      tag === "workaround"
    ) {
      return tag;
    }
  }
  return "constraint";
}

function memoryScopeFromTags(tags: readonly string[]): string {
  return tags.length === 0 ? "repo" : tags.slice(0, 5).join(",");
}

function projectMemoryRecordFromLocal(
  memory: LocalMemory,
): ProjectMemoryRecord {
  return {
    id: memory.memory_id,
    recordedAt: memory.updated_at,
    source: "user",
    statement: memory.statement,
    tags: [...new Set([memory.type, memory.scope])],
  };
}

function tokenize(text: string): readonly string[] {
  return [...new Set(text.toLowerCase().match(/[a-z0-9_.$-]{3,}/g) ?? [])];
}

function scoreChunk(chunk: SourceChunk, terms: readonly string[]): number {
  return (
    scoreText(
      `${chunk.relativePath}\n${chunk.symbol ?? ""}\n${chunk.text}`,
      terms,
    ) + trustWeight(chunk.trust)
  );
}

function scoreText(text: string, terms: readonly string[]): number {
  const haystack = text.toLowerCase();
  return terms.reduce(
    (score, term) => score + (haystack.includes(term) ? 1 : 0),
    0,
  );
}

function trustWeight(trust: SourceChunk["trust"]): number {
  switch (trust) {
    case "trusted_instruction":
      return 5;
    case "project_source":
      return 4;
    case "project_documentation":
      return 3;
    case "project_memory":
      return 2;
    case "untrusted_content":
      return 1;
  }
}

function sourceCountsFor(
  context: readonly ContextItem[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of context) {
    counts[item.trust] = (counts[item.trust] ?? 0) + 1;
  }
  return counts;
}

function mapOutcome(
  outcome: OutcomeRequest["outcome"],
): NonNullable<UsageEvent["safe_attributes"]["outcome"]> {
  switch (outcome) {
    case "accepted":
      return "helpful";
    case "changed":
      return "partial";
    case "rejected":
      return "missed";
    case "unknown":
      return "partial";
  }
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
