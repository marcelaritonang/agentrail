#!/usr/bin/env node
import { join } from "node:path";

import {
  createContextRelay,
  createFileMemoryStore,
  resolveWorkspaceRoot,
} from "@agentrail-sdk/context";

import { parseAgentRailCommand } from "./args.js";
import {
  setupClient,
  uninstallClient,
  updateClientIdentity,
} from "./clients.js";
import { runDoctorCommand } from "./commands/doctor.js";
import {
  createHttpDeviceApi,
  credentialProjectKey,
  openExternalBrowser,
  runLoginCommand,
} from "./commands/login.js";
import { runLogoutCommand } from "./commands/logout.js";
import {
  pushMemoryToApi,
  runMemoryExpireCommand,
  runMemoryListCommand,
  runMemoryPushCommand,
} from "./commands/memory.js";
import { selectCredentialStore } from "./credentials/platform-store.js";
import type { CommandResult } from "./types.js";

const CLI_PACKAGE_VERSION = "0.1.2";

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
        return runDoctorCommand(command);
      }
      case "context": {
        const relay = createContextRelay({
          workspaceRoot: command.root,
          privacyMode: "local-only",
          client: "cli",
          packageVersion: CLI_PACKAGE_VERSION,
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
      case "login": {
        const root = await resolveWorkspaceRoot(command.root);
        const store = await selectCredentialStore({
          directory: join(root, ".agentrail", "credentials"),
        });
        const projectKey = command.projectKey ?? credentialProjectKey(root);
        return runLoginCommand({
          api: createHttpDeviceApi({ baseUrl: command.apiUrl }),
          apiUrl: command.apiUrl,
          client: command.client,
          packageVersion: CLI_PACKAGE_VERSION,
          projectKey,
          store,
          openBrowser: command.openBrowser
            ? openExternalBrowser
            : async () => {},
          sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
          updateManagedClient: (identity) =>
            updateClientIdentity({
              client: command.client,
              root,
              identity,
              ...(command.codexConfig === undefined
                ? {}
                : { codexConfig: command.codexConfig }),
            }).then(() => undefined),
        });
      }
      case "logout": {
        const root = await resolveWorkspaceRoot(command.root);
        const store = await selectCredentialStore({
          directory: join(root, ".agentrail", "credentials"),
        });
        return runLogoutCommand({
          store,
          projectKey: command.projectKey ?? credentialProjectKey(root),
        });
      }
      case "memory": {
        const root = await resolveWorkspaceRoot(command.root);
        const memoryStore = await createFileMemoryStore({ root });
        if (command.action === "list") {
          return runMemoryListCommand({ store: memoryStore });
        }
        if (command.memoryId === undefined) {
          return { exitCode: 2, stdout: "", stderr: "--id is required.\n" };
        }
        if (command.action === "expire") {
          return runMemoryExpireCommand({
            memoryId: command.memoryId,
            store: memoryStore,
          });
        }
        const memory = memoryStore
          .list({ includeInactive: true })
          .find((record) => record.memory_id === command.memoryId);
        if (memory === undefined) {
          return {
            exitCode: 1,
            stdout: "",
            stderr: `Unknown memory: ${command.memoryId}\n`,
          };
        }
        const credentialStore = await selectCredentialStore({
          directory: join(root, ".agentrail", "credentials"),
        });
        const credential = await credentialStore.get(
          credentialProjectKey(root),
        );
        return runMemoryPushCommand({
          privacyMode: "metrics-only",
          credential,
          memory,
          push: (record, activeCredential) =>
            pushMemoryToApi({
              apiUrl: command.apiUrl ?? "https://agentrail.id",
              credential: activeCredential,
              memory: record,
            }),
          markPushed: (memoryId) => memoryStore.markPushed(memoryId),
          markReviewRequired: (memoryId) =>
            memoryStore.markReviewRequired(memoryId),
        });
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
    "  agentrail login --client codex --root <workspace> --api-url https://agentrail.id",
    "  agentrail doctor --root <workspace> --json",
    "  agentrail context --root <workspace> --task <task> --token-budget <n> --json",
    "  agentrail logout --root <workspace>",
    "  agentrail memory list --root <workspace>",
    "  agentrail memory push --id <memory-id> --root <workspace> --api-url https://agentrail.id",
    "  agentrail memory expire --id <memory-id> --root <workspace>",
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
