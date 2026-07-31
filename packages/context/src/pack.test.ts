import { mkdir, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { createContextRelay } from "./pack.js";

async function makeQualityFixture(): Promise<string> {
  const root = join(tmpdir(), `agentrail-pack-${process.pid}-${Date.now()}`);
  await mkdir(join(root, "src"), { recursive: true });
  await writeFile(
    join(root, "AGENTS.md"),
    "# Project rules\n\nDo not change session cookie semantics.\n",
  );
  await writeFile(
    join(root, "src", "auth.ts"),
    [
      "export function createSession(userId: string) {",
      "  return { userId, kind: 'session' };",
      "}",
      "",
      "export function revokeSession(sessionId: string) {",
      "  return sessionId.length > 0;",
      "}",
    ].join("\n"),
  );
  await writeFile(
    join(root, "src", "auth.test.ts"),
    "import { createSession } from './auth';\n",
  );
  await writeFile(join(root, ".env"), "SECRET=value\n");
  return root;
}

describe("Context Relay pack service", () => {
  it("returns a budgeted local Context Pack without absolute paths", async () => {
    const root = await makeQualityFixture();
    try {
      const relay = createContextRelay({
        workspaceRoot: root,
        privacyMode: "local-only",
        client: "vitest",
        packageVersion: "0.1.0",
        now: () => new Date("2026-07-30T00:00:00.000Z"),
      });

      const pack = await relay.prepareContext({
        task: "Add OAuth login without changing current session semantics",
        tokenBudget: 1_500,
        focus: ["auth", "session"],
      });

      expect(pack.status).toBe("ready");
      expect(pack.measurement.returnedTokensEstimate).toBeLessThanOrEqual(
        1_500,
      );
      expect(pack.context.map((item) => item.path)).toEqual(
        expect.arrayContaining([
          "AGENTS.md",
          "src/auth.ts",
          "src/auth.test.ts",
        ]),
      );
      expect(pack.context.every((item) => item.reasons.length > 0)).toBe(true);
      expect(pack.context.every((item) => !isAbsolute(item.path))).toBe(true);
      expect(pack.receiptUrl).toBeNull();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("stores and recalls local memory records", async () => {
    const root = await makeQualityFixture();
    try {
      const relay = createContextRelay({
        workspaceRoot: root,
        privacyMode: "local-only",
        client: "vitest",
        packageVersion: "0.1.0",
        now: () => new Date("2026-07-30T00:00:00.000Z"),
      });

      const remembered = await relay.remember({
        statement: "Auth sessions must stay backwards compatible.",
        tags: ["auth"],
      });
      const recalled = await relay.recall({ query: "auth session", limit: 5 });

      expect(remembered.statement).toContain("Auth sessions");
      expect(recalled.map((record) => record.id)).toContain(remembered.id);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
