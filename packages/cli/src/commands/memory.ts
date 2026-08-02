import type { LocalMemory, MemoryStore } from "@agentrail-sdk/context";

import type { CommandResult } from "../types.js";

export type MemoryPushInput = {
  privacyMode: "local-only" | "metrics-only" | "evidence-sync";
  credential: string | null;
  memory: LocalMemory;
  push: (
    memory: LocalMemory,
    credential: string,
  ) => Promise<
    | { status: "stored"; revision: number }
    | { status: "conflict"; currentRevision: number }
  >;
  markPushed: (memoryId: string) => Promise<void> | void;
  markReviewRequired: (memoryId: string) => Promise<void> | void;
};

export async function runMemoryPushCommand(
  input: MemoryPushInput,
): Promise<CommandResult> {
  if (input.privacyMode === "local-only") {
    return {
      exitCode: 2,
      stdout: "",
      stderr: "Memory push requires a non-local privacy mode.\n",
    };
  }
  if (!input.credential) {
    return {
      exitCode: 2,
      stdout: "",
      stderr: "Memory push requires an active credential.\n",
    };
  }

  const result = await input.push(input.memory, input.credential);
  if (result.status === "conflict") {
    await input.markReviewRequired(input.memory.memory_id);
    return {
      exitCode: 1,
      stdout: "",
      stderr: `Memory requires review at revision ${result.currentRevision}.\n`,
    };
  }
  await input.markPushed(input.memory.memory_id);
  return {
    exitCode: 0,
    stdout: `Pushed memory ${input.memory.memory_id} at revision ${result.revision}.\n`,
    stderr: "",
  };
}

export async function runMemoryListCommand(input: {
  store: MemoryStore;
}): Promise<CommandResult> {
  const memories = input.store.list({ includeInactive: true });
  if (memories.length === 0) {
    return {
      exitCode: 0,
      stdout: "No local project memories.\n",
      stderr: "",
    };
  }
  return {
    exitCode: 0,
    stdout:
      memories
        .map((memory) =>
          [
            memory.memory_id,
            memory.status,
            `r${memory.revision}`,
            memory.type,
            memory.scope,
            memory.statement.length === 0 ? "[deleted]" : memory.statement,
          ].join("\t"),
        )
        .join("\n") + "\n",
    stderr: "",
  };
}

export async function runMemoryExpireCommand(input: {
  memoryId: string;
  store: MemoryStore;
}): Promise<CommandResult> {
  await input.store.expire(input.memoryId);
  return {
    exitCode: 0,
    stdout: `Expired memory ${input.memoryId}.\n`,
    stderr: "",
  };
}

export async function pushMemoryToApi(input: {
  apiUrl: string;
  credential: string;
  memory: LocalMemory;
  fetch?: typeof fetch;
}): Promise<
  | { status: "stored"; revision: number }
  | { status: "conflict"; currentRevision: number }
> {
  const fetchFn = input.fetch ?? fetch;
  const response = await fetchFn(
    `${input.apiUrl.replace(/\/+$/, "")}/v1/memories`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${input.credential}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(memorySyncEnvelope(input.memory)),
    },
  );
  const parsed = (await response.json()) as Record<string, unknown>;
  if (response.status === 409 && typeof parsed.current_revision === "number") {
    return { status: "conflict", currentRevision: parsed.current_revision };
  }
  if (response.ok && typeof parsed.revision === "number") {
    return { status: "stored", revision: parsed.revision };
  }
  throw new Error(`Memory push failed with HTTP ${response.status}.`);
}

function memorySyncEnvelope(memory: LocalMemory): Record<string, unknown> {
  return {
    schema_version: memory.schema_version,
    memory_id: memory.memory_id,
    revision: memory.revision,
    type: memory.type,
    status: memory.status,
    ...(memory.statement_redacted === undefined
      ? {}
      : { statement_redacted: memory.statement_redacted }),
    scope: memory.scope,
    source_kind: memory.source_kind,
    expires_at: memory.expires_at,
    updated_at: memory.updated_at,
    ...(memory.tombstone === undefined ? {} : { tombstone: memory.tombstone }),
  };
}
