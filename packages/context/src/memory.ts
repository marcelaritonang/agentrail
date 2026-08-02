import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  ProjectMemorySyncSchema,
  type ProjectMemorySync,
} from "@agentrail-sdk/contracts";

export type LocalMemory = ProjectMemorySync & { statement: string };

type MaybePromise<T> = T | Promise<T>;

export type MemoryStore = {
  remember(input: {
    memoryId: string;
    statement: string;
    type: LocalMemory["type"];
    scope: string;
    expiresAt?: string | null;
  }): Promise<LocalMemory>;
  expire(memoryId: string): Promise<void>;
  delete(memoryId: string): Promise<void>;
  recall(): readonly LocalMemory[];
  list(input?: { includeInactive?: boolean }): readonly LocalMemory[];
  pendingPushes(): readonly string[];
  markPushed(memoryId: string): MaybePromise<void>;
  markReviewRequired(memoryId: string): MaybePromise<void>;
};

export function createMemoryStore(
  input: {
    now?: () => Date;
    initialMemories?: readonly LocalMemory[];
    pendingMemoryIds?: readonly string[];
    onChange?: (snapshot: {
      memories: readonly LocalMemory[];
      pendingMemoryIds: readonly string[];
    }) => MaybePromise<void>;
  } = {},
): MemoryStore {
  const now = input.now ?? (() => new Date());
  const memories = new Map(
    (input.initialMemories ?? []).map((memory) => [memory.memory_id, memory]),
  );
  const pending = new Set(input.pendingMemoryIds ?? []);
  const changed =
    input.onChange ??
    (() => {
      // In-memory store: nothing to persist.
    });
  const timestamp = () => now().toISOString();
  const get = (memoryId: string) => {
    const memory = memories.get(memoryId);
    if (!memory) throw new Error(`Unknown memory: ${memoryId}`);
    return memory;
  };

  const snapshot = () => ({
    memories: [...memories.values()],
    pendingMemoryIds: [...pending],
  });
  const persist = () => changed(snapshot());
  const refreshExpiry = (memory: LocalMemory): boolean => {
    if (
      memory.status !== "active" ||
      memory.expires_at === null ||
      new Date(memory.expires_at) > now()
    ) {
      return false;
    }
    memories.set(memory.memory_id, {
      ...memory,
      revision: memory.revision + 1,
      status: "expired",
      updated_at: timestamp(),
    });
    pending.add(memory.memory_id);
    return true;
  };
  const refreshAll = () => {
    for (const memory of memories.values()) {
      refreshExpiry(memory);
    }
  };
  const inactive = (memory: LocalMemory) => memory.status !== "active";

  return {
    async remember(value) {
      const memory: LocalMemory = {
        schema_version: 1,
        memory_id: value.memoryId,
        revision: 1,
        type: value.type,
        status: "active",
        statement: value.statement,
        statement_redacted: value.statement,
        scope: value.scope,
        source_kind: "explicit_tool",
        expires_at: value.expiresAt ?? null,
        updated_at: timestamp(),
      };
      memories.set(memory.memory_id, memory);
      pending.add(memory.memory_id);
      await persist();
      return memory;
    },
    async expire(memoryId) {
      const memory = get(memoryId);
      memories.set(memoryId, {
        ...memory,
        revision: memory.revision + 1,
        status: "expired",
        updated_at: timestamp(),
      });
      pending.add(memoryId);
      await persist();
    },
    async delete(memoryId) {
      const memory = get(memoryId);
      memories.set(memoryId, {
        ...memory,
        revision: memory.revision + 1,
        status: "deleted",
        statement: "",
        statement_redacted: undefined,
        updated_at: timestamp(),
        tombstone: { deleted_at: timestamp(), reason_code: "user_deleted" },
      });
      pending.add(memoryId);
      await persist();
    },
    recall: () => {
      refreshAll();
      return [...memories.values()].filter((memory) => !inactive(memory));
    },
    list: (options = {}) => {
      refreshAll();
      return [...memories.values()].filter(
        (memory) => options.includeInactive || !inactive(memory),
      );
    },
    pendingPushes: () => [...pending],
    markPushed: (memoryId) => {
      pending.delete(memoryId);
      return persist();
    },
    markReviewRequired: (memoryId) => {
      const memory = get(memoryId);
      memories.set(memoryId, {
        ...memory,
        status: "review_required",
        updated_at: timestamp(),
      });
      pending.add(memoryId);
      return persist();
    },
  };
}

export async function createFileMemoryStore(input: {
  root: string;
  now?: () => Date;
}): Promise<MemoryStore> {
  const filePath = localMemoryFilePath(input.root);
  const file = await readMemoryFile(filePath);
  return createMemoryStore({
    ...(input.now === undefined ? {} : { now: input.now }),
    initialMemories: file.memories,
    pendingMemoryIds: file.pendingMemoryIds,
    onChange: (snapshot) =>
      writeMemoryFile({
        filePath,
        memories: snapshot.memories,
        pendingMemoryIds: snapshot.pendingMemoryIds,
      }),
  });
}

export function localMemoryFilePath(root: string): string {
  return resolve(root, ".agentrail", "memory", "v2.json");
}

type MemoryFile = {
  version: 2;
  memories: readonly LocalMemory[];
  pendingMemoryIds: readonly string[];
};

async function readMemoryFile(filePath: string): Promise<MemoryFile> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return { version: 2, memories: [], pendingMemoryIds: [] };
  }
  if (typeof parsed !== "object" || parsed === null) {
    return { version: 2, memories: [], pendingMemoryIds: [] };
  }
  const value = parsed as {
    memories?: unknown;
    pendingMemoryIds?: unknown;
  };
  const memories = Array.isArray(value.memories)
    ? value.memories.flatMap((memory) => {
        const parsedMemory = parseLocalMemory(memory);
        return parsedMemory === null ? [] : [parsedMemory];
      })
    : [];
  const ids = new Set(memories.map((memory) => memory.memory_id));
  const pendingMemoryIds = Array.isArray(value.pendingMemoryIds)
    ? value.pendingMemoryIds.filter(
        (memoryId): memoryId is string =>
          typeof memoryId === "string" && ids.has(memoryId),
      )
    : [];
  return { version: 2, memories, pendingMemoryIds };
}

async function writeMemoryFile(input: {
  filePath: string;
  memories: readonly LocalMemory[];
  pendingMemoryIds: readonly string[];
}): Promise<void> {
  await mkdir(resolve(input.filePath, ".."), { recursive: true });
  const tempPath = `${input.filePath}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(
    tempPath,
    `${JSON.stringify(
      {
        version: 2,
        memories: input.memories,
        pendingMemoryIds: input.pendingMemoryIds,
      },
      null,
      2,
    )}\n`,
  );
  await rename(tempPath, input.filePath);
}

function parseLocalMemory(input: unknown): LocalMemory | null {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return null;
  }
  const { statement, ...syncCandidate } = input as Record<string, unknown>;
  if (typeof statement !== "string") return null;
  const parsed = ProjectMemorySyncSchema.safeParse(syncCandidate);
  if (!parsed.success) return null;
  return { ...parsed.data, statement };
}
