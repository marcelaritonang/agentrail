import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { createContextRelay } from "./pack.js";
import { createFileMemoryStore, createMemoryStore } from "./memory.js";
import type { UsageSpool } from "./spool-flush.js";

const NOW = new Date("2026-08-02T00:00:00.000Z");
const ID = `mem_${"a".repeat(24)}`;

async function fixtureRoot(): Promise<string> {
  const root = join(
    tmpdir(),
    `agentrail-memory-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(join(root, "src", "app.ts"), "export const app = true;\n");
  return root;
}

describe("local project memory", () => {
  it("keeps explicit remembers local until push is called", async () => {
    const store = createMemoryStore({ now: () => NOW });
    await store.remember({
      memoryId: ID,
      statement: "Never expose the internal API token.",
      type: "constraint",
      scope: "api",
    });

    expect(store.list()).toHaveLength(1);
    expect(store.pendingPushes()).toEqual([ID]);
  });

  it("persists structured local memory so CLI and MCP see the same ledger", async () => {
    const root = await fixtureRoot();
    try {
      const store = await createFileMemoryStore({ root, now: () => NOW });
      await store.remember({
        memoryId: ID,
        statement: "Use Hono for ingestion routes.",
        type: "architecture",
        scope: "apps/ingest",
      });

      const reloaded = await createFileMemoryStore({ root, now: () => NOW });
      expect(reloaded.list({ includeInactive: true })).toEqual([
        expect.objectContaining({
          memory_id: ID,
          revision: 1,
          status: "active",
          statement: "Use Hono for ingestion routes.",
          statement_redacted: "Use Hono for ingestion routes.",
        }),
      ]);
      expect(reloaded.pendingPushes()).toEqual([ID]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("marks a record expired when the injected clock passes its expiry", async () => {
    let current = NOW;
    const store = createMemoryStore({ now: () => current });
    await store.remember({
      memoryId: ID,
      statement: "Only use server-side object storage reads.",
      type: "constraint",
      scope: "receipts",
      expiresAt: "2026-08-02T00:10:00.000Z",
    });

    current = new Date("2026-08-02T00:10:01.000Z");

    expect(store.recall()).toEqual([]);
    expect(store.list({ includeInactive: true })[0]).toMatchObject({
      status: "expired",
      revision: 2,
    });
  });

  it("excludes deleted and expired records from default recall but retains them for audit", async () => {
    const store = createMemoryStore({ now: () => NOW });
    await store.remember({
      memoryId: ID,
      statement: "Use TypeScript.",
      type: "convention",
      scope: "repo",
    });
    await store.expire(ID);
    await store.remember({
      memoryId: `mem_${"b".repeat(24)}`,
      statement: "Use SQLite.",
      type: "architecture",
      scope: "repo",
    });
    await store.delete(`mem_${"b".repeat(24)}`);

    expect(store.recall()).toEqual([]);
    expect(store.list({ includeInactive: true })).toHaveLength(2);
  });

  it("does not create durable memory unless the explicit write tool is called", async () => {
    const root = await fixtureRoot();
    try {
      const relay = createContextRelay({
        workspaceRoot: root,
        privacyMode: "local-only",
        client: "vitest",
        packageVersion: "0.1.0",
      });

      await relay.prepareContext({
        task: "Remember that auth must stay backwards compatible.",
        tokenBudget: 1_000,
      });

      const store = await createFileMemoryStore({ root, now: () => NOW });
      expect(store.list({ includeInactive: true })).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("never includes local memory statements in hosted metrics events", async () => {
    const root = await fixtureRoot();
    const events: unknown[] = [];
    const usageSpool: UsageSpool = {
      append: async (event) => {
        events.push(event);
      },
      readBatch: async () => [],
      removeAccepted: async () => undefined,
      setRetryAfter: async () => undefined,
      markActivationStale: async () => undefined,
    };

    try {
      const relay = createContextRelay({
        workspaceRoot: root,
        privacyMode: "metrics-only",
        client: "vitest",
        packageVersion: "0.1.0",
        installationId: "inst_metrics",
        usageSpool,
      });
      await relay.remember({
        statement: "Keep the private billing token out of evidence.",
        tags: ["billing"],
      });
      await relay.prepareContext({
        task: "billing token safety",
        tokenBudget: 1_000,
      });

      expect(events).toHaveLength(1);
      expect(JSON.stringify(events)).not.toContain("private billing token");
      expect(JSON.stringify(events)).not.toContain("Keep the");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
