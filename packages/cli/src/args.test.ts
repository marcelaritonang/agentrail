import { describe, expect, it } from "vitest";

import { parseAgentRailCommand } from "./args.js";

describe("AgentRail CLI args", () => {
  it("parses setup, doctor, context, and uninstall commands", () => {
    expect(
      parseAgentRailCommand([
        "setup",
        "--client",
        "codex",
        "--client",
        "claude",
        "--root",
        "D:\\work\\agent-app",
      ]),
    ).toMatchObject({
      name: "setup",
      clients: ["codex", "claude"],
      root: "D:\\work\\agent-app",
    });

    expect(parseAgentRailCommand(["doctor", "--json"])).toMatchObject({
      name: "doctor",
      json: true,
    });

    expect(
      parseAgentRailCommand([
        "context",
        "--task",
        "Add OAuth",
        "--token-budget",
        "4000",
        "--json",
      ]),
    ).toMatchObject({
      name: "context",
      task: "Add OAuth",
      tokenBudget: 4_000,
      json: true,
    });

    expect(
      parseAgentRailCommand(["uninstall", "--client", "codex"]),
    ).toMatchObject({
      name: "uninstall",
      clients: ["codex"],
    });
  });

  it("parses hosted login and logout commands without requiring cloud mode", () => {
    expect(
      parseAgentRailCommand([
        "login",
        "--client",
        "codex",
        "--root",
        "D:\\work\\agent-app",
        "--api-url",
        "https://agentrail.id",
        "--no-open",
      ]),
    ).toMatchObject({
      name: "login",
      client: "codex",
      root: "D:\\work\\agent-app",
      apiUrl: "https://agentrail.id",
      openBrowser: false,
    });

    expect(
      parseAgentRailCommand(["logout", "--root", "D:\\work\\agent-app"]),
    ).toMatchObject({
      name: "logout",
      root: "D:\\work\\agent-app",
    });
  });

  it("rejects unknown flags and missing required command input", () => {
    expect(() => parseAgentRailCommand(["doctor", "--bad"])).toThrow(
      /unknown flag/i,
    );
    expect(() => parseAgentRailCommand(["context", "--task", "x"])).toThrow(
      /token-budget/i,
    );
  });
});
