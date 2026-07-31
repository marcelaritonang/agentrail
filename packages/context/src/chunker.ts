import { createHash } from "node:crypto";

import type { SourceTrust } from "./types.js";
import { relativeContextPath } from "./types.js";
import { estimateTokens } from "./tokens.js";

export type SourceChunk = {
  sourceId: string;
  relativePath: string;
  startLine: number;
  endLine: number;
  symbol: string | null;
  text: string;
  contentHash: string;
  trust: SourceTrust;
  modifiedAt: string;
  estimatedTokens: number;
};

type ChunkUnit = {
  startLine: number;
  endLine: number;
  symbol: string | null;
  text: string;
};

export function chunkTextFile(input: {
  relativePath: string;
  text: string;
  trust: SourceTrust;
  modifiedAt: string;
  maxEstimatedTokens?: number;
}): readonly SourceChunk[] {
  const relativePath = relativeContextPath(input.relativePath);
  const text = input.text.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  if (text.length === 0) return [];
  const maxEstimatedTokens = input.maxEstimatedTokens ?? 1_024;
  const lines = text.split("\n");
  const units = detectUnits(relativePath, lines, input.trust);

  return units.flatMap((unit) =>
    splitUnit({
      unit,
      relativePath,
      trust: input.trust,
      modifiedAt: input.modifiedAt,
      maxEstimatedTokens,
    }),
  );
}

function detectUnits(
  relativePath: string,
  lines: readonly string[],
  trust: SourceTrust,
): readonly ChunkUnit[] {
  const lower = relativePath.toLowerCase();
  if (trust === "trusted_instruction" || lower.endsWith(".md")) {
    return markdownUnits(lines);
  }
  if (/\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(lower)) {
    return codeUnits(lines);
  }
  return paragraphUnits(lines);
}

function markdownUnits(lines: readonly string[]): readonly ChunkUnit[] {
  const starts = lines
    .map((line, index) => {
      const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
      if (match === null) return null;
      return {
        line: index + 1,
        symbol: match[2] ?? null,
      };
    })
    .filter(
      (start): start is { line: number; symbol: string | null } =>
        start !== null,
    );

  if (starts.length === 0) return paragraphUnits(lines);

  return starts.map((start, index) => {
    const next = starts[index + 1];
    const endLine = next === undefined ? lines.length : next.line - 1;
    return makeUnit(lines, start.line, endLine, start.symbol);
  });
}

function codeUnits(lines: readonly string[]): readonly ChunkUnit[] {
  const starts = lines
    .map((line, index) => {
      const match =
        /^(?:export\s+)?(?:async\s+)?(?:function|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/.exec(
          line.trim(),
        ) ?? /^(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=/.exec(line.trim());
      if (match === null) return null;
      return {
        line: index + 1,
        symbol: match[1] ?? null,
      };
    })
    .filter(
      (start): start is { line: number; symbol: string | null } =>
        start !== null,
    );

  if (starts.length === 0) return paragraphUnits(lines);

  const firstStart = starts[0];
  const prefix =
    firstStart !== undefined && firstStart.line > 1
      ? [makeUnit(lines, 1, firstStart.line - 1, null)]
      : [];

  return [
    ...prefix,
    ...starts.map((start, index) => {
      const next = starts[index + 1];
      const endLine = next === undefined ? lines.length : next.line - 1;
      return makeUnit(lines, start.line, endLine, start.symbol);
    }),
  ].filter((unit) => unit.text.trim().length > 0);
}

function paragraphUnits(lines: readonly string[]): readonly ChunkUnit[] {
  const units: ChunkUnit[] = [];
  let startLine = 1;
  for (let index = 0; index < lines.length; index += 1) {
    if (lines[index]?.trim() !== "") continue;
    if (startLine <= index) {
      units.push(makeUnit(lines, startLine, index, null));
    }
    startLine = index + 2;
  }
  if (startLine <= lines.length) {
    units.push(makeUnit(lines, startLine, lines.length, null));
  }
  return units.length === 0 ? [makeUnit(lines, 1, lines.length, null)] : units;
}

function splitUnit(input: {
  unit: ChunkUnit;
  relativePath: string;
  trust: SourceTrust;
  modifiedAt: string;
  maxEstimatedTokens: number;
}): SourceChunk[] {
  if (estimateTokens(input.unit.text) <= input.maxEstimatedTokens) {
    return [toSourceChunk(input)];
  }

  const chunks: SourceChunk[] = [];
  const lines = input.unit.text.split("\n");
  let pending: string[] = [];
  let pendingStartLine = input.unit.startLine;

  const flush = (endLine: number) => {
    if (pending.length === 0) return;
    chunks.push(
      toSourceChunk({
        ...input,
        unit: {
          startLine: pendingStartLine,
          endLine,
          symbol: input.unit.symbol,
          text: pending.join("\n"),
        },
      }),
    );
    pending = [];
  };

  lines.forEach((line, offset) => {
    const lineNumber = input.unit.startLine + offset;
    if (estimateTokens(line) > input.maxEstimatedTokens) {
      flush(lineNumber - 1);
      chunks.push(
        ...splitLongLine({
          line,
          lineNumber,
          relativePath: input.relativePath,
          symbol: input.unit.symbol,
          trust: input.trust,
          modifiedAt: input.modifiedAt,
          maxEstimatedTokens: input.maxEstimatedTokens,
        }),
      );
      pendingStartLine = lineNumber + 1;
      return;
    }

    const candidate = [...pending, line];
    if (
      pending.length > 0 &&
      estimateTokens(candidate.join("\n")) > input.maxEstimatedTokens
    ) {
      flush(lineNumber - 1);
      pendingStartLine = lineNumber;
    }
    pending.push(line);
  });

  flush(input.unit.endLine);
  return chunks;
}

function splitLongLine(input: {
  line: string;
  lineNumber: number;
  relativePath: string;
  symbol: string | null;
  trust: SourceTrust;
  modifiedAt: string;
  maxEstimatedTokens: number;
}): SourceChunk[] {
  const maxBytes = Math.max(4, input.maxEstimatedTokens * 4);
  const chunks: SourceChunk[] = [];
  let current = "";
  for (const char of input.line) {
    if (
      current.length > 0 &&
      Buffer.byteLength(`${current}${char}`, "utf8") > maxBytes
    ) {
      chunks.push(
        toSourceChunk({
          relativePath: input.relativePath,
          trust: input.trust,
          modifiedAt: input.modifiedAt,
          maxEstimatedTokens: input.maxEstimatedTokens,
          unit: {
            startLine: input.lineNumber,
            endLine: input.lineNumber,
            symbol: input.symbol,
            text: current,
          },
        }),
      );
      current = "";
    }
    current += char;
  }
  if (current.length > 0) {
    chunks.push(
      toSourceChunk({
        relativePath: input.relativePath,
        trust: input.trust,
        modifiedAt: input.modifiedAt,
        maxEstimatedTokens: input.maxEstimatedTokens,
        unit: {
          startLine: input.lineNumber,
          endLine: input.lineNumber,
          symbol: input.symbol,
          text: current,
        },
      }),
    );
  }
  return chunks;
}

function toSourceChunk(input: {
  unit: ChunkUnit;
  relativePath: string;
  trust: SourceTrust;
  modifiedAt: string;
  maxEstimatedTokens: number;
}): SourceChunk {
  const contentHash = sha256(input.unit.text);
  return {
    sourceId: sha256(
      `${input.relativePath}:${input.unit.startLine}:${input.unit.endLine}:${contentHash}`,
    ),
    relativePath: input.relativePath,
    startLine: input.unit.startLine,
    endLine: input.unit.endLine,
    symbol: input.unit.symbol,
    text: input.unit.text,
    contentHash,
    trust: input.trust,
    modifiedAt: input.modifiedAt,
    estimatedTokens: estimateTokens(input.unit.text),
  };
}

function makeUnit(
  lines: readonly string[],
  startLine: number,
  endLine: number,
  symbol: string | null,
): ChunkUnit {
  return {
    startLine,
    endLine,
    symbol,
    text: lines.slice(startLine - 1, endLine).join("\n"),
  };
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
