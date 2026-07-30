import { describe, expect, it } from "vitest";

import type { AgentRailReadModel, AgentRailToolResult } from "./types";
import { AGENTRAIL_MCP_TOOL_NAMES } from "./tools";
import { CONTEXT_TOOL_NAMES } from "./profile";
import { registerAgentRailMcpTools } from "./server";

const readModel: AgentRailReadModel = {
  async listTraces() {
    return { items: [], total: 0 };
  },
  async getTrace() {
    return null;
  },
  async getPayloadStatus() {
    return {
      found: false,
      payloadMode: null,
      hasPayload: false,
      truncated: false,
      reason: "span_not_found",
    };
  },
};

describe("AgentRail MCP server registration", () => {
  it("registers exactly the approved read-only tools", () => {
    const registered: {
      name: string;
      description: string;
      handler: (input: Record<string, unknown>) => Promise<AgentRailToolResult>;
    }[] = [];

    registerAgentRailMcpTools(
      {
        registerTool(name, config, handler) {
          registered.push({
            name,
            description: config.description,
            handler,
          });
        },
      },
      { readModel },
    );

    expect(registered.map((tool) => tool.name)).toEqual(
      AGENTRAIL_MCP_TOOL_NAMES,
    );
    expect(
      registered.every((tool) => /read-only/i.test(tool.description)),
    ).toBe(true);
  });

  it("registers exactly context tools for the context profile", () => {
    const registered: {
      name: string;
      description: string;
      handler: (input: Record<string, unknown>) => Promise<AgentRailToolResult>;
    }[] = [];

    registerAgentRailMcpTools(
      {
        registerTool(name, config, handler) {
          registered.push({
            name,
            description: config.description,
            handler,
          });
        },
      },
      {
        relay: {
          async prepareContext() {
            throw new Error("not needed");
          },
          async recall() {
            return [];
          },
          async remember() {
            throw new Error("not needed");
          },
          async reportOutcome() {
            throw new Error("not needed");
          },
        },
      },
      "context",
    );

    expect(registered.map((tool) => tool.name)).toEqual(CONTEXT_TOOL_NAMES);
    expect(
      registered.some((tool) => /read-only/i.test(tool.description)),
    ).toBe(true);
  });
});
