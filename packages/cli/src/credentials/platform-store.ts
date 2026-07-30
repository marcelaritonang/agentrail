import { createRestrictedFileCredentialStore } from "./file-store.js";
import type { CredentialStore } from "./types.js";
import { spawn } from "node:child_process";

export type CommandRunner = (
  command: string,
  args: readonly string[],
  stdin?: string,
) => Promise<{ exitCode: number; stdout: string; stderr: string }>;

export async function selectCredentialStore(input: {
  directory: string;
  platform?: NodeJS.Platform;
  commandAvailable?: (command: string) => Promise<boolean>;
  runner?: CommandRunner;
}): Promise<CredentialStore> {
  const platform = input.platform ?? process.platform;
  const commandAvailable = input.commandAvailable ?? defaultCommandAvailable;
  const runner = input.runner ?? defaultCommandRunner;

  if (platform === "darwin" && (await commandAvailable("security"))) {
    return createMacOsKeychainStore(runner);
  }

  if (platform === "linux" && (await commandAvailable("secret-tool"))) {
    return createSecretServiceStore(runner);
  }

  return createRestrictedFileCredentialStore({
    directory: input.directory,
    platform,
  });
}

function createMacOsKeychainStore(runner: CommandRunner): CredentialStore {
  return {
    kind: "platform",
    async get(projectKey) {
      const result = await runner("security", [
        "find-generic-password",
        "-s",
        "agentrail",
        "-a",
        projectKey,
        "-w",
      ]);
      return result.exitCode === 0 && result.stdout.trim().length > 0
        ? result.stdout.trim()
        : null;
    },
    async set(projectKey, credential) {
      await runner("security", [
        "delete-generic-password",
        "-s",
        "agentrail",
        "-a",
        projectKey,
      ]);
      const result = await runner(
        "security",
        ["add-generic-password", "-U", "-s", "agentrail", "-a", projectKey],
        credential,
      );
      if (result.exitCode !== 0) {
        throw new Error(
          result.stderr || "Failed to store AgentRail credential.",
        );
      }
    },
    async delete(projectKey) {
      await runner("security", [
        "delete-generic-password",
        "-s",
        "agentrail",
        "-a",
        projectKey,
      ]);
    },
  };
}

function createSecretServiceStore(runner: CommandRunner): CredentialStore {
  return {
    kind: "platform",
    async get(projectKey) {
      const result = await runner("secret-tool", [
        "lookup",
        "application",
        "agentrail",
        "project",
        projectKey,
      ]);
      return result.exitCode === 0 && result.stdout.trim().length > 0
        ? result.stdout.trim()
        : null;
    },
    async set(projectKey, credential) {
      const result = await runner(
        "secret-tool",
        [
          "store",
          "--label",
          "AgentRail installation credential",
          "application",
          "agentrail",
          "project",
          projectKey,
        ],
        credential,
      );
      if (result.exitCode !== 0) {
        throw new Error(
          result.stderr || "Failed to store AgentRail credential.",
        );
      }
    },
    async delete(projectKey) {
      await runner("secret-tool", [
        "clear",
        "application",
        "agentrail",
        "project",
        projectKey,
      ]);
    },
  };
}

async function defaultCommandAvailable(command: string): Promise<boolean> {
  const probe =
    process.platform === "win32"
      ? await defaultCommandRunner("where", [command])
      : await defaultCommandRunner("command", ["-v", command]);
  return probe.exitCode === 0;
}

async function defaultCommandRunner(
  command: string,
  args: readonly string[],
  stdin?: string,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, [...args], {
      shell: command === "command",
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (error) => {
      resolve({ exitCode: 127, stdout: "", stderr: error.message });
    });
    child.on("close", (code) => {
      resolve({
        exitCode: code ?? 1,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
    if (stdin !== undefined) {
      child.stdin.end(stdin);
    } else {
      child.stdin.end();
    }
  });
}
