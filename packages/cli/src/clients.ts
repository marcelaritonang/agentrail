import { mkdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";

import { atomicReplace, createTimestampedBackup } from "./config-backup.js";
import type { AgentRailClient, ClientMutationResult } from "./types.js";

const BEGIN = "# BEGIN AGENTRAIL MANAGED BLOCK";
const END = "# END AGENTRAIL MANAGED BLOCK";

export async function setupClient(input: {
  client: AgentRailClient;
  root: string;
  codexConfig?: string;
}): Promise<ClientMutationResult> {
  if (input.client === "codex") {
    return setupCodex(input.root, input.codexConfig ?? defaultCodexConfigPath());
  }
  return setupClaude(input.root);
}

export async function uninstallClient(input: {
  client: AgentRailClient;
  root: string;
  codexConfig?: string;
}): Promise<ClientMutationResult> {
  if (input.client === "codex") {
    return uninstallCodex(
      input.codexConfig ?? defaultCodexConfigPath(),
    );
  }
  return uninstallClaude(input.root);
}

async function setupCodex(
  root: string,
  configPath: string,
): Promise<ClientMutationResult> {
  const existing = await readOptionalText(configPath);
  const block = codexManagedBlock(root);
  if (existing.includes(block)) {
    return {
      client: "codex",
      configPath,
      backupPath: null,
      status: "already_configured",
    };
  }
  if (hasManagedBlock(existing)) {
    const next = existing.replace(
      new RegExp(`${escapeRegex(BEGIN)}[\\s\\S]*?${escapeRegex(END)}`),
      block.trimEnd(),
    );
    const backup = await createTimestampedBackup(configPath);
    await atomicReplace(configPath, ensureTrailingNewline(next));
    return {
      client: "codex",
      configPath,
      backupPath: backup.backupPath,
      status: "installed",
    };
  }
  if (/\[mcp_servers\.agentrail\]/.test(existing)) {
    throw new Error(
      "Codex config has an unmanaged agentrail MCP server. Remove it or let AgentRail own the managed block.",
    );
  }

  const backup = await createTimestampedBackup(configPath);
  const prefix = existing.trimEnd();
  const next = `${prefix.length === 0 ? "" : `${prefix}\n\n`}${block}`;
  await atomicReplace(configPath, next);
  return {
    client: "codex",
    configPath,
    backupPath: backup.backupPath,
    status: "installed",
  };
}

async function setupClaude(root: string): Promise<ClientMutationResult> {
  const configPath = resolve(root, ".mcp.json");
  const parsed = await readClaudeConfig(configPath);
  const entry = mcpEntry(root, "claude");
  const existing = parsed.mcpServers.agentrail;
  if (JSON.stringify(existing) === JSON.stringify(entry)) {
    return {
      client: "claude",
      configPath,
      backupPath: null,
      status: "already_configured",
    };
  }
  if (existing !== undefined) {
    throw new Error("Claude .mcp.json has an unmanaged agentrail server.");
  }
  parsed.mcpServers.agentrail = entry;
  const backup = await createTimestampedBackup(configPath);
  await atomicReplace(configPath, `${JSON.stringify(parsed, null, 2)}\n`);
  return {
    client: "claude",
    configPath,
    backupPath: backup.backupPath,
    status: "installed",
  };
}

async function uninstallCodex(configPath: string): Promise<ClientMutationResult> {
  const existing = await readOptionalText(configPath);
  if (!hasManagedBlock(existing)) {
    return {
      client: "codex",
      configPath,
      backupPath: null,
      status: "not_configured",
    };
  }
  const next = existing
    .replace(new RegExp(`${escapeRegex(BEGIN)}[\\s\\S]*?${escapeRegex(END)}\\n?`), "")
    .trimEnd();
  const backup = await createTimestampedBackup(configPath);
  await atomicReplace(configPath, ensureTrailingNewline(next));
  return {
    client: "codex",
    configPath,
    backupPath: backup.backupPath,
    status: "removed",
  };
}

async function uninstallClaude(root: string): Promise<ClientMutationResult> {
  const configPath = resolve(root, ".mcp.json");
  const parsed = await readClaudeConfig(configPath);
  if (parsed.mcpServers.agentrail === undefined) {
    return {
      client: "claude",
      configPath,
      backupPath: null,
      status: "not_configured",
    };
  }
  delete parsed.mcpServers.agentrail;
  const backup = await createTimestampedBackup(configPath);
  await atomicReplace(configPath, `${JSON.stringify(parsed, null, 2)}\n`);
  return {
    client: "claude",
    configPath,
    backupPath: backup.backupPath,
    status: "removed",
  };
}

async function readClaudeConfig(
  configPath: string,
): Promise<{ mcpServers: Record<string, unknown>; [key: string]: unknown }> {
  const text = await readOptionalText(configPath);
  if (text.trim().length === 0) return { mcpServers: {} };
  const parsed = JSON.parse(text) as { mcpServers?: unknown; [key: string]: unknown };
  if (parsed.mcpServers === undefined) {
    parsed.mcpServers = {};
  }
  if (
    typeof parsed.mcpServers !== "object" ||
    parsed.mcpServers === null ||
    Array.isArray(parsed.mcpServers)
  ) {
    throw new Error("Claude .mcp.json mcpServers must be an object.");
  }
  return parsed as { mcpServers: Record<string, unknown>; [key: string]: unknown };
}

function codexManagedBlock(root: string): string {
  const entry = mcpEntry(root, "codex");
  return [
    BEGIN,
    "[mcp_servers.agentrail]",
    `command = ${tomlString(entry.command)}`,
    `args = [${entry.args.map(tomlString).join(", ")}]`,
    `env = { AGENTRAIL_WORKSPACE_ROOT = ${tomlString(root)}, AGENTRAIL_PRIVACY_MODE = "local-only", AGENTRAIL_CLIENT = "codex" }`,
    END,
    "",
  ].join("\n");
}

function mcpEntry(root: string, client: AgentRailClient) {
  return {
    command: "npx",
    args: ["-y", "@agentrail-sdk/mcp", "--profile", "context"],
    env: {
      AGENTRAIL_WORKSPACE_ROOT: root,
      AGENTRAIL_PRIVACY_MODE: "local-only",
      AGENTRAIL_CLIENT: client,
    },
  };
}

function defaultCodexConfigPath(): string {
  return join(homedir(), ".codex", "config.toml");
}

async function readOptionalText(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch {
    await mkdir(dirname(path), { recursive: true });
    return "";
  }
}

function hasManagedBlock(text: string): boolean {
  return text.includes(BEGIN) && text.includes(END);
}

function tomlString(input: string): string {
  return `"${input
    .replaceAll("\\", "\\\\")
    .replaceAll("\"", "\\\"")
    .replaceAll("\n", "\\n")
    .replaceAll("\r", "\\r")
    .replaceAll("\t", "\\t")}"`;
}

function ensureTrailingNewline(input: string): string {
  return input.length === 0 ? "" : `${input.trimEnd()}\n`;
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
