import {
  ProjectMemorySyncSchema,
  type ProjectMemorySync,
} from "@agentrail-sdk/contracts";

export type MemorySyncStore = {
  upsert(
    input: ProjectMemorySync & {
      projectId: string;
      installationId: string;
      statementRedacted: string | null;
    },
  ): Promise<
    | { status: "stored"; revision: number }
    | { status: "conflict"; currentRevision: number }
  >;
};

export async function syncMemory(input: {
  auth: { projectId: string; installationId: string };
  input: unknown;
  store: MemorySyncStore;
}): Promise<
  | { status: "stored"; revision: number }
  | { status: "conflict"; currentRevision: number }
> {
  const memory = ProjectMemorySyncSchema.parse(input.input);
  return input.store.upsert({
    ...memory,
    projectId: input.auth.projectId,
    installationId: input.auth.installationId,
    statementRedacted: memory.statement_redacted ?? null,
  });
}
