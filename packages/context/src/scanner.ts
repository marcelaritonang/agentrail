import {
  lstat,
  opendir,
  readFile,
  realpath,
  stat,
} from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

import { createWorkspaceIgnore, isSecretPath } from "./ignore.js";
import type { ContextWarning, SourceTrust } from "./types.js";
import { relativeContextPath } from "./types.js";
import { resolveWorkspaceRoot } from "./workspace.js";

export type ScanLimits = {
  maxFiles: number;
  maxFileBytes: number;
  deadlineMs: number;
};

export type ScannedFile = {
  relativePath: string;
  absolutePath: string;
  bytes: number;
  modifiedAt: string;
  trust: SourceTrust;
};

const DEFAULT_SCAN_LIMITS: ScanLimits = {
  maxFiles: 10_000,
  maxFileBytes: 1_048_576,
  deadlineMs: 5_000,
};

type MutableScanState = {
  files: ScannedFile[];
  warnings: ContextWarning[];
  complete: boolean;
  stopped: boolean;
};

export async function scanWorkspace(input: {
  root: string;
  include?: readonly string[];
  exclude?: readonly string[];
  limits?: Partial<ScanLimits>;
  now?: () => number;
}): Promise<{
  files: readonly ScannedFile[];
  warnings: readonly ContextWarning[];
  complete: boolean;
}> {
  const root = await resolveWorkspaceRoot(input.root);
  const limits = { ...DEFAULT_SCAN_LIMITS, ...input.limits };
  const now = input.now ?? Date.now;
  const startedAt = now();
  const state: MutableScanState = {
    files: [],
    warnings: [],
    complete: true,
    stopped: false,
  };

  const gitignore = await readOptionalText(resolve(root, ".gitignore"));
  const agentrailignore = await readOptionalText(resolve(root, ".agentrailignore"));
  const ignoreRules = createWorkspaceIgnore({
    ...(gitignore === undefined ? {} : { gitignore }),
    ...(agentrailignore === undefined ? {} : { agentrailignore }),
    ...(input.exclude === undefined ? {} : { exclude: input.exclude }),
  });
  const includePrefixes = normalizeFilters(input.include);

  if (deadlineReached(now, startedAt, limits.deadlineMs)) {
    markPartial(state, "partial_index", "Scan deadline was reached.");
    return resultFromState(state);
  }

  await visitDirectory({
    absoluteDirectory: root,
    realRoot: root,
    root,
    ignoreRules,
    includePrefixes,
    limits,
    now,
    startedAt,
    state,
  });

  return resultFromState(state);
}

async function visitDirectory(input: {
  absoluteDirectory: string;
  realRoot: string;
  root: string;
  ignoreRules: ReturnType<typeof createWorkspaceIgnore>;
  includePrefixes: readonly string[];
  limits: ScanLimits;
  now: () => number;
  startedAt: number;
  state: MutableScanState;
}): Promise<void> {
  if (input.state.stopped) return;
  if (deadlineReached(input.now, input.startedAt, input.limits.deadlineMs)) {
    markPartial(input.state, "partial_index", "Scan deadline was reached.");
    input.state.stopped = true;
    return;
  }

  const directory = await opendir(input.absoluteDirectory);
  const entries = [];
  for await (const entry of directory) {
    entries.push(entry);
  }
  entries.sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    if (input.state.stopped) return;
    const absolutePath = resolve(input.absoluteDirectory, entry.name);
    const relativePath = toRelativeContextPath(input.root, absolutePath);
    if (relativePath === null) continue;
    if (input.ignoreRules.ignores(relativePath)) {
      if (isSecretPath(relativePath)) {
        input.state.warnings.push({
          code: "secret_excluded",
          detail: `${relativePath} matched secret exclusion rules.`,
        });
      }
      continue;
    }
    if (!matchesInclude(relativePath, input.includePrefixes)) continue;

    const metadata = await lstat(absolutePath);
    if (metadata.isSymbolicLink()) {
      await handleSymlink({
        ...input,
        absolutePath,
        relativePath,
      });
      continue;
    }
    if (metadata.isDirectory()) {
      await visitDirectory({
        ...input,
        absoluteDirectory: absolutePath,
      });
      continue;
    }
    if (!metadata.isFile()) continue;
    await considerFile({
      ...input,
      absolutePath,
      relativePath,
      bytes: metadata.size,
      modifiedAt: metadata.mtime.toISOString(),
    });
  }
}

async function handleSymlink(input: {
  absolutePath: string;
  relativePath: string;
  realRoot: string;
  root: string;
  ignoreRules: ReturnType<typeof createWorkspaceIgnore>;
  includePrefixes: readonly string[];
  limits: ScanLimits;
  now: () => number;
  startedAt: number;
  state: MutableScanState;
}): Promise<void> {
  let target: string;
  try {
    target = await realpath(input.absolutePath);
  } catch {
    return;
  }
  if (!isContained(input.realRoot, target)) {
    input.state.warnings.push({
      code: "symlink_escape",
      detail: `${input.relativePath} resolves outside the workspace.`,
    });
    return;
  }

  const metadata = await stat(target);
  if (!metadata.isFile()) return;
  await considerFile({
    ...input,
    absolutePath: target,
    bytes: metadata.size,
    modifiedAt: metadata.mtime.toISOString(),
  });
}

async function considerFile(input: {
  absolutePath: string;
  relativePath: string;
  bytes: number;
  modifiedAt: string;
  limits: ScanLimits;
  state: MutableScanState;
}): Promise<void> {
  if (input.state.files.length >= input.limits.maxFiles) {
    markPartial(
      input.state,
      "file_limit",
      `File limit of ${input.limits.maxFiles} was reached.`,
    );
    input.state.stopped = true;
    return;
  }

  if (input.bytes > input.limits.maxFileBytes) {
    input.state.warnings.push({
      code: "file_too_large",
      detail: `${input.relativePath} exceeds ${input.limits.maxFileBytes} bytes.`,
    });
    return;
  }

  const content = await readFile(input.absolutePath);
  if (content.includes(0)) {
    input.state.warnings.push({
      code: "binary_excluded",
      detail: `${input.relativePath} appears to be binary.`,
    });
    return;
  }

  input.state.files.push({
    relativePath: input.relativePath,
    absolutePath: input.absolutePath,
    bytes: input.bytes,
    modifiedAt: input.modifiedAt,
    trust: inferTrust(input.relativePath),
  });
}

async function readOptionalText(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return undefined;
  }
}

function toRelativeContextPath(root: string, absolutePath: string): string | null {
  const relativePath = relative(root, absolutePath).replaceAll("\\", "/");
  try {
    return relativeContextPath(relativePath);
  } catch {
    return null;
  }
}

function normalizeFilters(filters: readonly string[] | undefined): readonly string[] {
  if (filters === undefined) return [];
  return filters
    .map((filter) => filter.replaceAll("\\", "/").replace(/^\/+/, ""))
    .filter((filter) => filter.length > 0);
}

function matchesInclude(
  relativePath: string,
  includePrefixes: readonly string[],
): boolean {
  if (includePrefixes.length === 0) return true;
  return includePrefixes.some(
    (prefix) => relativePath === prefix || relativePath.startsWith(`${prefix}/`),
  );
}

function deadlineReached(
  now: () => number,
  startedAt: number,
  deadlineMs: number,
): boolean {
  return now() - startedAt >= deadlineMs;
}

function markPartial(
  state: MutableScanState,
  code: ContextWarning["code"],
  detail: string,
): void {
  state.complete = false;
  if (!state.warnings.some((warning) => warning.code === code)) {
    state.warnings.push({ code, detail });
  }
}

function resultFromState(state: MutableScanState) {
  return {
    files: state.files,
    warnings: state.warnings,
    complete: state.complete,
  };
}

function inferTrust(relativePath: string): SourceTrust {
  const lower = relativePath.toLowerCase();
  if (lower === "agents.md" || lower.endsWith("/agents.md")) {
    return "trusted_instruction";
  }
  if (lower.endsWith(".md") || lower.startsWith("docs/")) {
    return "project_documentation";
  }
  if (/\.(?:ts|tsx|js|jsx|mjs|cjs|json|css|sql)$/.test(lower)) {
    return "project_source";
  }
  return "untrusted_content";
}

function isContained(root: string, candidate: string): boolean {
  return candidate === root || candidate.startsWith(`${root}${sep}`);
}
