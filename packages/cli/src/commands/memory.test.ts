import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";
import { createFileMemoryStore } from "@agentrail-sdk/context";

import { runAgentRailCommand } from "../main.js";
import { pushMemoryToApi, runMemoryPushCommand } from "./memory.js";

const NOW = new Date("2026-08-02T00:00:00.000Z");
const MEMORY_ID = `mem_${"a".repeat(24)}`;

async function fixtureRoot(): Promise<string> {
  const root = join(
    tmpdir(),
    `agentrail-cli-memory-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
  await mkdir(root, { recursive: true });
  return root;
}

describe("agentrail memory push", () => {
  it("requires a non-local mode and an active credential before uploading", async () => {
    const result = await runMemoryPushCommand({
      privacyMode: "local-only",
      credential: null,
      memory: {
        schema_version: 1,
        memory_id: MEMORY_ID,
        revision: 1,
        type: "constraint",
        status: "active",
        statement: "Do not upload in local-only mode.",
        statement_redacted: "Do not upload in local-only mode.",
        scope: "repo",
        source_kind: "explicit_tool",
        expires_at: null,
        updated_at: NOW.toISOString(),
      },
      push: async () => {
        throw new Error("must not upload");
      },
      markPushed: async () => undefined,
      markReviewRequired: async () => undefined,
    });
    expect(result.exitCode).toBe(2);
    expect(result.stderr).toMatch(/non-local privacy mode/i);
  });

  it("marks local memory review-required on hosted revision conflict", async () => {
    let reviewRequired = false;
    const result = await runMemoryPushCommand({
      privacyMode: "metrics-only",
      credential: "ar_inst_test",
      memory: {
        schema_version: 1,
        memory_id: MEMORY_ID,
        revision: 1,
        type: "constraint",
        status: "active",
        statement: "Hosted revision will conflict.",
        statement_redacted: "Hosted revision will conflict.",
        scope: "repo",
        source_kind: "explicit_tool",
        expires_at: null,
        updated_at: NOW.toISOString(),
      },
      push: async () => ({ status: "conflict", currentRevision: 2 }),
      markPushed: async () => {
        throw new Error("must not mark pushed");
      },
      markReviewRequired: async () => {
        reviewRequired = true;
      },
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("revision 2");
    expect(reviewRequired).toBe(true);
  });

  it("posts only the redacted memory envelope to the hosted API", async () => {
    const sentBodies: unknown[] = [];
    const result = await pushMemoryToApi({
      apiUrl: "https://agentrail.id",
      credential: "ar_inst_test",
      memory: {
        schema_version: 1,
        memory_id: MEMORY_ID,
        revision: 1,
        type: "constraint",
        status: "active",
        statement: "Raw local statement must stay local.",
        statement_redacted: "[redacted] must stay local.",
        scope: "repo",
        source_kind: "explicit_tool",
        expires_at: null,
        updated_at: NOW.toISOString(),
      },
      fetch: async (_url, init) => {
        sentBodies.push(JSON.parse(String(init?.body)));
        return Response.json({ revision: 1 });
      },
    });

    expect(result).toEqual({ status: "stored", revision: 1 });
    expect(sentBodies).toEqual([
      expect.objectContaining({
        memory_id: MEMORY_ID,
        statement_redacted: "[redacted] must stay local.",
      }),
    ]);
    expect(JSON.stringify(sentBodies)).not.toContain("Raw local statement");
    expect(JSON.stringify(sentBodies)).not.toContain("project_id");
    expect(JSON.stringify(sentBodies)).not.toContain("installation_id");
  });
});

describe("agentrail memory lifecycle commands", () => {
  it("lists and expires the structured local ledger from the CLI", async () => {
    const root = await fixtureRoot();
    try {
      const store = await createFileMemoryStore({ root, now: () => NOW });
      await store.remember({
        memoryId: MEMORY_ID,
        statement: "Use server routes for receipt evidence.",
        type: "constraint",
        scope: "receipts",
      });

      const listed = await runAgentRailCommand([
        "memory",
        "list",
        "--root",
        root,
      ]);
      expect(listed.exitCode).toBe(0);
      expect(listed.stdout).toContain(MEMORY_ID);
      expect(listed.stdout).toContain("Use server routes");

      const expired = await runAgentRailCommand([
        "memory",
        "expire",
        "--root",
        root,
        "--id",
        MEMORY_ID,
      ]);
      expect(expired.exitCode).toBe(0);

      const reloaded = await createFileMemoryStore({ root, now: () => NOW });
      expect(reloaded.list({ includeInactive: true })[0]).toMatchObject({
        memory_id: MEMORY_ID,
        status: "expired",
        revision: 2,
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
