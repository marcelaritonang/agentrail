import { resolve } from "node:path";

import type { AgentRailClient, AgentRailCommand } from "./types.js";

export function parseAgentRailCommand(
  argv: readonly string[],
): AgentRailCommand {
  const [command, ...rest] = argv;
  if (command === undefined || command === "--help" || command === "-h") {
    return { name: "help" };
  }

  const flags = parseFlags(command === "memory" ? rest.slice(1) : rest);
  switch (command) {
    case "setup": {
      const codexConfig = stringFlag(flags, "codex-config");
      return {
        name: "setup",
        clients: clientsFromFlags(flags),
        root: stringFlag(flags, "root") ?? process.cwd(),
        ...(codexConfig === undefined ? {} : { codexConfig }),
      };
    }
    case "doctor":
      ensureNoUnknownFlags(flags, ["root", "json"]);
      return {
        name: "doctor",
        root: stringFlag(flags, "root") ?? process.cwd(),
        json: booleanFlag(flags, "json"),
      };
    case "context": {
      ensureNoUnknownFlags(flags, ["root", "task", "token-budget", "json"]);
      const task = stringFlag(flags, "task");
      const tokenBudget = numberFlag(flags, "token-budget");
      if (task === undefined) throw new Error("--task is required");
      if (tokenBudget === undefined)
        throw new Error("--token-budget is required");
      return {
        name: "context",
        root: stringFlag(flags, "root") ?? process.cwd(),
        task,
        tokenBudget,
        json: booleanFlag(flags, "json"),
      };
    }
    case "uninstall": {
      const codexConfig = stringFlag(flags, "codex-config");
      return {
        name: "uninstall",
        clients: clientsFromFlags(flags),
        root: stringFlag(flags, "root") ?? process.cwd(),
        ...(codexConfig === undefined ? {} : { codexConfig }),
      };
    }
    case "login": {
      ensureNoUnknownFlags(flags, [
        "client",
        "root",
        "codex-config",
        "api-url",
        "no-open",
        "project-key",
      ]);
      const codexConfig = stringFlag(flags, "codex-config");
      const projectKey = stringFlag(flags, "project-key");
      return {
        name: "login",
        client: singleClientFromFlags(flags),
        root: stringFlag(flags, "root") ?? process.cwd(),
        apiUrl: stringFlag(flags, "api-url") ?? "https://agentrail.id",
        openBrowser: !booleanFlag(flags, "no-open"),
        ...(codexConfig === undefined ? {} : { codexConfig }),
        ...(projectKey === undefined ? {} : { projectKey }),
      };
    }
    case "logout": {
      ensureNoUnknownFlags(flags, ["root", "project-key"]);
      const projectKey = stringFlag(flags, "project-key");
      return {
        name: "logout",
        root: stringFlag(flags, "root") ?? process.cwd(),
        ...(projectKey === undefined ? {} : { projectKey }),
      };
    }
    case "memory": {
      const [action] = rest;
      if (action !== "list" && action !== "push" && action !== "expire") {
        throw new Error("memory requires list, push, or expire");
      }
      ensureNoUnknownFlags(flags, ["id", "root", "api-url"]);
      const memoryId = stringFlag(flags, "id");
      if (
        (action === "push" || action === "expire") &&
        memoryId === undefined
      ) {
        throw new Error("--id is required");
      }

      const apiUrl = stringFlag(flags, "api-url");
      return {
        name: "memory",
        action,
        root: stringFlag(flags, "root") ?? process.cwd(),
        ...(memoryId === undefined ? {} : { memoryId }),
        ...(apiUrl === undefined ? {} : { apiUrl }),
      };
    }
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

function parseFlags(argv: readonly string[]): Map<string, string[]> {
  const flags = new Map<string, string[]>();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === undefined) continue;
    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected positional argument: ${arg}`);
    }
    const name = arg.slice(2);
    if (name.length === 0) throw new Error("Unknown flag");
    const current = flags.get(name) ?? [];
    const next = argv[index + 1];
    if (next === undefined || next.startsWith("--")) {
      current.push("true");
    } else {
      current.push(next);
      index += 1;
    }
    flags.set(name, current);
  }
  return flags;
}

function clientsFromFlags(
  flags: Map<string, string[]>,
): readonly AgentRailClient[] {
  ensureNoUnknownFlags(flags, ["client", "root", "codex-config"]);
  const values = flags.get("client") ?? ["codex"];
  const clients = values.map((value) => {
    if (value !== "codex" && value !== "claude") {
      throw new Error("--client must be codex or claude");
    }
    return value;
  });
  return [...new Set(clients)];
}

function singleClientFromFlags(flags: Map<string, string[]>): AgentRailClient {
  const values = flags.get("client") ?? ["codex"];
  if (values.length !== 1) {
    throw new Error("--client accepts one value for login");
  }
  const value = values[0] ?? "codex";
  if (value !== "codex" && value !== "claude") {
    throw new Error("--client must be codex or claude");
  }
  return value;
}

function ensureNoUnknownFlags(
  flags: Map<string, string[]>,
  allowed: readonly string[],
): void {
  for (const flag of flags.keys()) {
    if (!allowed.includes(flag)) {
      throw new Error(`Unknown flag: --${flag}`);
    }
  }
}

function stringFlag(
  flags: Map<string, string[]>,
  name: string,
): string | undefined {
  const value = flags.get(name)?.at(-1);
  if (value === undefined || value === "true") return undefined;
  return name === "root" ? resolve(value) : value;
}

function numberFlag(
  flags: Map<string, string[]>,
  name: string,
): number | undefined {
  const value = stringFlag(flags, name);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`--${name} must be an integer`);
  }
  return parsed;
}

function booleanFlag(flags: Map<string, string[]>, name: string): boolean {
  return flags.has(name);
}
