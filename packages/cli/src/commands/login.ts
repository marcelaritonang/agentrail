import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

import type { AgentRailClient, CommandResult } from "../types.js";
import type { CredentialStore, DeviceApi } from "../credentials/types.js";

export type LoginCommandInput = {
  api: DeviceApi;
  apiUrl: string;
  client: AgentRailClient;
  packageVersion: string;
  projectKey: string;
  store: CredentialStore;
  openBrowser: (url: string) => Promise<void>;
  sleep: (ms: number) => Promise<void>;
  updateManagedClient: (input: {
    apiUrl: string;
    installationId: string;
    privacyMode: "metrics-only";
  }) => Promise<void>;
  writeStdout?: (chunk: string) => void;
  writeStderr?: (chunk: string) => void;
};

export async function runLoginCommand(
  input: LoginCommandInput,
): Promise<CommandResult> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const writeStdout = (chunk: string) => {
    stdout.push(chunk);
    input.writeStdout?.(chunk);
  };
  const writeStderr = (chunk: string) => {
    stderr.push(chunk);
    input.writeStderr?.(chunk);
  };

  try {
    const issued = await input.api.issue({
      schema_version: 1,
      client_type: input.client,
      package_version: input.packageVersion,
    });
    writeStdout(
      [
        "AgentRail hosted metrics activation",
        `Open: ${issued.verification_uri_complete}`,
        `User code: ${issued.user_code}`,
        "Waiting for approval. Local Context Relay remains available offline.",
        "",
      ].join("\n"),
    );

    await input.openBrowser(issued.verification_uri_complete);
    let intervalMs = Math.max(1, issued.interval) * 1_000;

    for (;;) {
      await input.sleep(intervalMs);
      const token = await input.api.poll(issued.device_code);
      switch (token.status) {
        case "authorization_pending":
          intervalMs = Math.max(1, token.interval ?? issued.interval) * 1_000;
          break;
        case "slow_down":
          intervalMs += 5_000;
          break;
        case "expired_token":
          writeStderr(
            "AgentRail activation expired. Run agentrail login again. Local Context Relay still works in local-only mode.\n",
          );
          return finish(1, stdout, stderr);
        case "access_denied":
          writeStderr(
            "AgentRail activation was denied. Local Context Relay still works in local-only mode.\n",
          );
          return finish(1, stdout, stderr);
        case "approved":
          await input.store.set(input.projectKey, token.credential);
          await input.updateManagedClient({
            apiUrl: input.apiUrl,
            installationId: token.installation_id,
            privacyMode: "metrics-only",
          });
          writeStdout(
            `AgentRail hosted metrics activated for installation ${token.installation_id}.\n`,
          );
          return finish(0, stdout, stderr);
      }
    }
  } catch (error) {
    writeStderr(
      `${errorMessage(error)}\nLocal Context Relay still works in local-only mode.\n`,
    );
    return finish(1, stdout, stderr);
  }
}

export function credentialProjectKey(root: string): string {
  return `workspace_${createHash("sha256").update(resolve(root)).digest("hex").slice(0, 32)}`;
}

export function createHttpDeviceApi(input: {
  baseUrl: string;
  fetch?: typeof fetch;
}): DeviceApi {
  const fetchFn = input.fetch ?? fetch;
  const baseUrl = input.baseUrl.replace(/\/+$/, "");
  return {
    async issue(body) {
      return postJson(fetchFn, `${baseUrl}/v1/device/code`, body);
    },
    async poll(deviceCode) {
      return postJson(fetchFn, `${baseUrl}/v1/device/token`, {
        schema_version: 1,
        device_code: deviceCode,
      });
    },
  };
}

export async function openExternalBrowser(
  url: string,
  platform: NodeJS.Platform = process.platform,
): Promise<void> {
  const command =
    platform === "win32" ? "cmd" : platform === "darwin" ? "open" : "xdg-open";
  const args = platform === "win32" ? ["/c", "start", "", url] : [url];
  const child = spawn(command, args, {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
}

async function postJson<T>(
  fetchFn: typeof fetch,
  url: string,
  body: unknown,
): Promise<T> {
  const response = await fetchFn(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const parsed = (await response.json()) as T;
  if (!response.ok && !hasStatus(parsed)) {
    throw new Error(
      `AgentRail API request failed with HTTP ${response.status}.`,
    );
  }
  return parsed;
}

function hasStatus(value: unknown): value is { status: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "status" in value &&
    typeof value.status === "string"
  );
}

function finish(
  exitCode: number,
  stdout: readonly string[],
  stderr: readonly string[],
): CommandResult {
  return {
    exitCode,
    stdout: stdout.join(""),
    stderr: stderr.join(""),
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
