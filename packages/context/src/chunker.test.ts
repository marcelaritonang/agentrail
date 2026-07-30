import { describe, expect, it } from "vitest";

import { chunkTextFile } from "./chunker.js";

describe("source chunking", () => {
  it("creates deterministic TypeScript chunks with symbol labels", () => {
    const text = [
      "export function createSession() {",
      "  return true;",
      "}",
      "",
      "export function revokeSession() {",
      "  return true;",
      "}",
    ].join("\n");

    const chunks = chunkTextFile({
      relativePath: "src/auth.ts",
      text,
      trust: "project_source",
      modifiedAt: "2026-07-30T00:00:00.000Z",
    });
    const repeated = chunkTextFile({
      relativePath: "src/auth.ts",
      text,
      trust: "project_source",
      modifiedAt: "2026-07-30T00:00:00.000Z",
    });

    expect(chunks.map((chunk) => chunk.symbol)).toEqual(
      expect.arrayContaining(["createSession", "revokeSession"]),
    );
    expect(chunks.every((chunk) => chunk.startLine <= chunk.endLine)).toBe(true);
    expect(chunks.every((chunk) => chunk.estimatedTokens <= 1_024)).toBe(true);
    expect(new Set(chunks.map((chunk) => chunk.sourceId)).size).toBe(
      chunks.length,
    );
    expect(chunks.map((chunk) => chunk.sourceId)).toEqual(
      repeated.map((chunk) => chunk.sourceId),
    );
  });

  it("chunks Markdown by headings", () => {
    const chunks = chunkTextFile({
      relativePath: "docs/session.md",
      text: "# Session\n\nIntro\n\n## Rotation\n\nDetails\n",
      trust: "project_documentation",
      modifiedAt: "2026-07-30T00:00:00.000Z",
    });

    expect(chunks.map((chunk) => chunk.symbol)).toEqual([
      "Session",
      "Rotation",
    ]);
  });

  it("normalizes CRLF and splits long unbroken text into bounded windows", () => {
    const chunks = chunkTextFile({
      relativePath: "notes.txt",
      text: `${"x".repeat(5_000)}\r\n${"y".repeat(5_000)}`,
      trust: "untrusted_content",
      modifiedAt: "2026-07-30T00:00:00.000Z",
      maxEstimatedTokens: 128,
    });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.text.includes("\r"))).toBe(false);
    expect(chunks.every((chunk) => chunk.estimatedTokens <= 128)).toBe(true);
  });
});
