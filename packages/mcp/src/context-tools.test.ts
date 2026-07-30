import { mkdir, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";
import { createContextRelay } from "@agentrail-sdk/context";

import { createAgentRailContextToolHandlers } from "./context-tools.js";

async function makeFixture(): Promise<string> {
  const root = join(tmpdir(), `agentrail-mcp-context-${process.pid}-${Date.now()}`);
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(join(root, "AGENTS.md"), "# Rules\n\nKeep auth stable.\n");
  await writeFile(
    join(root, "src", "auth.ts"),
    "export function createSession() { return true; }\n",
  );
  return root;
}

function parseResult<T>(text: string): T {
  return JSON.parse(text) as T;
}

describe("AgentRail MCP context tools", () => {
  it("prepares local context without exposing absolute paths", async () => {
    const root = await makeFixture();
    try {
      const handlers = createAgentRailContextToolHandlers({
        relay: createContextRelay({
          workspaceRoot: root,
          privacyMode: "local-only",
          client: "vitest",
          packageVersion: "0.1.0",
        }),
      });

      const result = await handlers.agentrail_prepare_context({
        task: "Change auth session logic",
        tokenBudget: 1_000,
      });
      const value = parseResult<{
        pack: { context: { path: string }[]; receiptUrl: string | null };
      }>(result.content[0].text);

      expect(value.pack.context.map((item) => item.path)).toContain(
        "src/auth.ts",
      );
      expect(value.pack.context.every((item) => !isAbsolute(item.path))).toBe(
        true,
      );
      expect(value.pack.receiptUrl).toBeNull();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("remembers, recalls, and reports outcome through the relay", async () => {
    const root = await makeFixture();
    try {
      const handlers = createAgentRailContextToolHandlers({
        relay: createContextRelay({
          workspaceRoot: root,
          privacyMode: "local-only",
          client: "vitest",
          packageVersion: "0.1.0",
        }),
      });

      const remembered = await handlers.agentrail_remember({
        statement: "Auth must keep existing session semantics.",
        tags: ["auth"],
      });
      const memory = parseResult<{ record: { id: string } }>(
        remembered.content[0].text,
      );
      const recalled = await handlers.agentrail_recall({
        query: "auth session",
      });
      const recalledValue = parseResult<{ records: { id: string }[] }>(
        recalled.content[0].text,
      );
      const outcome = await handlers.agentrail_report_outcome({
        packId: "pack_1",
        outcome: "accepted",
      });
      const outcomeValue = parseResult<{ receipt: { outcome: string } }>(
        outcome.content[0].text,
      );

      expect(recalledValue.records.map((record) => record.id)).toContain(
        memory.record.id,
      );
      expect(outcomeValue.receipt.outcome).toBe("accepted");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
