import { describe, expect, it } from "vitest";

import { runLoginCommand, type LoginCommandInput } from "./login.js";
import type { CredentialStore, DeviceApi } from "../credentials/types.js";

function memoryStore(events: string[] = []): CredentialStore & {
  values: Map<string, string>;
} {
  const values = new Map<string, string>();
  return {
    kind: "restricted-file",
    values,
    async get(projectKey) {
      return values.get(projectKey) ?? null;
    },
    async set(projectKey, credential) {
      events.push("store:set");
      values.set(projectKey, credential);
    },
    async delete(projectKey) {
      values.delete(projectKey);
    },
  };
}

function issueResponse() {
  return {
    device_code: "dev_secret_code_that_must_never_be_printed",
    user_code: "ABCD-EFGH-JKLM",
    verification_uri: "https://agentrail.id/activate",
    verification_uri_complete:
      "https://agentrail.id/activate?code=ABCD-EFGH-JKLM",
    expires_in: 600,
    interval: 2,
  };
}

function loginInput(overrides: Partial<LoginCommandInput> = {}): {
  input: LoginCommandInput;
  stdout: string[];
  stderr: string[];
  events: string[];
  sleeps: number[];
  store: ReturnType<typeof memoryStore>;
} {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const events: string[] = [];
  const sleeps: number[] = [];
  const store = memoryStore(events);
  const api: DeviceApi = {
    async issue() {
      return issueResponse();
    },
    async poll() {
      return {
        status: "approved",
        project_id: "proj_1",
        installation_id: "inst_1",
        credential: "ar_inst_credential_secret",
      };
    },
  };

  return {
    stdout,
    stderr,
    events,
    sleeps,
    store,
    input: {
      api,
      apiUrl: "https://agentrail.id",
      client: "codex",
      packageVersion: "0.1.1",
      projectKey: "project_a",
      store,
      openBrowser: async () => {
        events.push("browser:open");
      },
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      updateManagedClient: async () => {
        events.push("client:update");
      },
      writeStdout: (chunk) => {
        events.push(`stdout:${chunk}`);
        stdout.push(chunk);
      },
      writeStderr: (chunk) => {
        stderr.push(chunk);
      },
      ...overrides,
    },
  };
}

describe("agentrail login command", () => {
  it("prints verification instructions before opening the browser", async () => {
    const { input, events } = loginInput();

    await runLoginCommand(input);

    const firstStdout = events.findIndex((event) =>
      event.startsWith("stdout:"),
    );
    const browserOpen = events.indexOf("browser:open");
    expect(firstStdout).toBeGreaterThanOrEqual(0);
    expect(browserOpen).toBeGreaterThan(firstStdout);
    expect(events.join("\n")).toContain("ABCD-EFGH-JKLM");
  });

  it("polls using the server interval and backs off on slow_down", async () => {
    const pollResults: Awaited<ReturnType<DeviceApi["poll"]>>[] = [
      { status: "authorization_pending", interval: 2 },
      { status: "slow_down", interval: 2 },
      {
        status: "approved",
        project_id: "proj_1",
        installation_id: "inst_1",
        credential: "ar_inst_credential_secret",
      },
    ];
    const { input, sleeps } = loginInput({
      api: {
        async issue() {
          return issueResponse();
        },
        async poll() {
          return pollResults.shift() ?? { status: "access_denied" };
        },
      },
    });

    await runLoginCommand(input);

    expect(sleeps).toEqual([2_000, 2_000, 7_000]);
  });

  it("stores the credential before updating the managed MCP client and never prints it", async () => {
    const { input, events, stdout, stderr, store } = loginInput();

    const result = await runLoginCommand(input);

    expect(result.exitCode).toBe(0);
    expect(await store.get("project_a")).toBe("ar_inst_credential_secret");
    expect(events.indexOf("client:update")).toBeGreaterThan(
      events.indexOf("store:set"),
    );
    expect(
      `${stdout.join("")}${stderr.join("")}${result.stdout}${result.stderr}`,
    ).not.toContain("ar_inst_credential_secret");
  });

  it("exits non-zero with actionable guidance when the device code expires", async () => {
    const { input } = loginInput({
      api: {
        async issue() {
          return issueResponse();
        },
        async poll() {
          return { status: "expired_token" };
        },
      },
    });

    const result = await runLoginCommand(input);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/expired/i);
    expect(result.stderr).toMatch(/agentrail login/i);
    expect(result.stderr).toMatch(/local context relay still works/i);
  });

  it("leaves local Context Relay operational when hosted activation fails", async () => {
    const { input } = loginInput({
      api: {
        async issue() {
          throw new Error("network unavailable");
        },
        async poll() {
          throw new Error("not reached");
        },
      },
    });

    const result = await runLoginCommand(input);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/network unavailable/i);
    expect(result.stderr).toMatch(/local context relay still works/i);
  });
});
