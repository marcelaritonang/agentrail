import { describe, expect, it } from "vitest";

import { digestApiKey } from "./api-key.js";
import { createIngestApp, type IngestDependencies } from "./app.js";
import { digestInstallationCredential } from "./installation-auth.js";
import { syncMemory } from "./memory-sync.js";

const MEMORY_ID = `mem_${"a".repeat(24)}`;
const PROJECT_ID = "00000000-0000-4000-8000-000000000001";
const INSTALLATION_ID = "inst_00000000-0000-4000-8000-000000000001";
const INSTALLATION_CREDENTIAL = `ar_inst_${"b".repeat(43)}`;
const INSTALLATION_PEPPER = "pepper-32-bytes-or-more";

function validMemoryBody(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: 1,
    memory_id: MEMORY_ID,
    revision: 1,
    type: "constraint",
    status: "active",
    statement_redacted: "[redacted] token policy",
    scope: "api",
    source_kind: "explicit_tool",
    expires_at: null,
    updated_at: "2026-08-02T00:00:00.000Z",
    ...overrides,
  };
}

function memoryRequest(body: unknown): Request {
  return new Request("http://localhost/v1/memories", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${INSTALLATION_CREDENTIAL}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function appDependencies(
  memoryUpsert: IngestDependencies["memories"]["upsert"],
): IngestDependencies {
  return {
    apiKeyPepper: "unused",
    apiKeys: {
      findActiveByPrefix: async () => ({
        projectId: PROJECT_ID,
        keyDigest: digestApiKey(`ar_live_${"a".repeat(64)}`, "unused"),
      }),
    },
    queue: {
      enqueue: async () => ({ messageId: "unused" }),
      read: async () => null,
      ack: async () => undefined,
      fail: async () => undefined,
    },
    installations: {
      findActiveInstallationByPrefix: async () => ({
        projectId: PROJECT_ID,
        installationId: INSTALLATION_ID,
        credentialDigest: digestInstallationCredential(
          INSTALLATION_CREDENTIAL,
          INSTALLATION_PEPPER,
        ),
      }),
    },
    memories: { upsert: memoryUpsert },
    installationCredentialPepper: INSTALLATION_PEPPER,
    requestId: () => "req_memory",
  };
}

describe("memory sync", () => {
  it("canonicalizes authenticated project and installation and never persists raw statement", async () => {
    const stored: unknown[] = [];
    const response = await syncMemory({
      auth: { projectId: "project-auth", installationId: "inst-auth" },
      input: validMemoryBody(),
      store: {
        upsert: async (value) => {
          stored.push(value);
          return { status: "stored", revision: 1 } as const;
        },
      },
    });

    expect(response).toEqual({ status: "stored", revision: 1 });
    expect(stored).toEqual([
      expect.objectContaining({
        projectId: "project-auth",
        installationId: "inst-auth",
        statementRedacted: "[redacted] token policy",
      }),
    ]);
    expect(Object.keys(stored[0] as Record<string, unknown>)).not.toContain(
      "statement",
    );
    expect(JSON.stringify(stored)).not.toContain("raw statement");
  });

  it("returns only the current revision for a stale update", async () => {
    const response = await syncMemory({
      auth: { projectId: "project-auth", installationId: "inst-auth" },
      input: validMemoryBody({ statement_redacted: "safe" }),
      store: {
        upsert: async () => ({ status: "conflict", currentRevision: 2 }),
      },
    });
    expect(response).toEqual({ status: "conflict", currentRevision: 2 });
    expect(JSON.stringify(response)).not.toContain("safe");
  });

  it("rejects client-supplied project, installation, and raw statement fields", async () => {
    await expect(
      syncMemory({
        auth: { projectId: "project-auth", installationId: "inst-auth" },
        input: validMemoryBody({
          project_id: "client-project",
          installation_id: "client-installation",
          statement: "raw local statement",
        }),
        store: {
          upsert: async () => {
            throw new Error("must not store invalid memory");
          },
        },
      }),
    ).rejects.toThrow();
  });

  it("returns a bounded 409 from the route without memory content", async () => {
    const app = createIngestApp(
      appDependencies(async () => ({
        status: "conflict",
        currentRevision: 7,
      })),
    );

    const response = await app.request(
      memoryRequest(validMemoryBody({ statement_redacted: "safe content" })),
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toEqual({ current_revision: 7, request_id: "req_memory" });
    expect(JSON.stringify(body)).not.toContain("safe content");
  });
});
