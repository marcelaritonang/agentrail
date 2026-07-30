#!/usr/bin/env node
import { createContextRelay } from "@agentrail-sdk/context";

import { parseAgentRailCommand } from "./args.js";
import { setupClient, uninstallClient } from "./clients.js";
import type { CommandResult } from "./types.js";
import { resolveWorkspaceRoot } from "@agentrail-sdk/context";

export async function runAgentRailCommand(
  argv: readonly string[],
): Promise<CommandResult> {
  let command;
  try {
    command = parseAgentRailCommand(argv);
  } catch (error) {
    return {
      exitCode: 2,
      stdout: "",
      stderr: `${errorMessage(error)}\n\n${usage()}\n`,
    };
  }

  try {
    switch (command.name) {
      case "help":
        return { exitCode: 0, stdout: usage(), stderr: "" };
      case "doctor": {
        await resolveWorkspaceRoot(command.root);
        const checks = [
          {
            id: "workspace",
            status: "pass",
            detail: `Workspace root is readable.`,
            remediation: null,
          },
          {
            id: "privacy_mode",
            status: "pass",
            detail: "Local-only mode requires no login.",
            remediation: null,
          },
        ];
        return jsonOrText(
          command.json,
          { ok: true, checks },
          "AgentRail doctor passed.\n",
        );
      }
      case "context": {
        const relay = createContextRelay({
          workspaceRoot: command.root,
          privacyMode: "local-only",
          client: "cli",
          packageVersion: "0.1.0",
        });
        const pack = await relay.prepareContext({
          task: command.task,
          tokenBudget: command.tokenBudget,
        });
        return jsonOrText(
          command.json,
          { pack },
          `Prepared ${pack.context.length} context items.\n`,
        );
      }
      case "setup": {
        const results = [];
        for (const client of command.clients) {
          results.push(
            await setupClient({
              client,
              root: command.root,
              ...(command.codexConfig === undefined
                ? {}
                : { codexConfig: command.codexConfig }),
            }),
          );
        }
        return {
          exitCode: 0,
          stdout: `${JSON.stringify({ results }, null, 2)}\n`,
          stderr: "",
        };
      }
      case "uninstall": {
        const results = [];
        for (const client of command.clients) {
          results.push(
            await uninstallClient({
              client,
              root: command.root,
              ...(command.codexConfig === undefined
                ? {}
                : { codexConfig: command.codexConfig }),
            }),
          );
        }
        return {
          exitCode: 0,
          stdout: `${JSON.stringify({ results }, null, 2)}\n`,
          stderr: "",
        };
      }
    }
  } catch (error) {
    return { exitCode: 1, stdout: "", stderr: `${errorMessage(error)}\n` };
  }
}

async function main(): Promise<void> {
  const result = await runAgentRailCommand(process.argv.slice(2));
  if (result.stdout.length > 0) process.stdout.write(result.stdout);
  if (result.stderr.length > 0) process.stderr.write(result.stderr);
  process.exitCode = result.exitCode;
}

function jsonOrText(
  json: boolean,
  value: unknown,
  text: string,
): CommandResult {
  return {
    exitCode: 0,
    stdout: json ? `${JSON.stringify(value, null, 2)}\n` : text,
    stderr: "",
  };
}

function usage(): string {
  return [
    "AgentRail CLI",
    "",
    "Usage:",
    "  agentrail setup --client codex --root <workspace>",
    "  agentrail setup --client claude --root <workspace>",
    "  agentrail doctor --root <workspace> --json",
    "  agentrail context --root <workspace> --task <task> --token-budget <n> --json",
    "  agentrail uninstall --client codex --root <workspace>",
    "",
  ].join("\n");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

if (process.argv[1]?.endsWith("main.js")) {
  main().catch((error: unknown) => {
    process.stderr.write(`${errorMessage(error)}\n`);
    process.exitCode = 1;
  });
}
