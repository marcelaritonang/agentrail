import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import {
  createDatabaseReadModel,
  createEnvironmentConfig,
  type AgentRailMcpConfig,
} from "./read-model";
import type { AgentRailToolDependencies, AgentRailToolResult } from "./types";
import { createAgentRailToolHandlers, safeErrorMessage } from "./tools";

type ToolHandler = (
  input: Record<string, unknown>,
) => Promise<AgentRailToolResult>;

type ToolConfig = {
  description: string;
  inputSchema: Record<string, z.ZodType>;
};

export type AgentRailToolRegistrar = {
  registerTool(name: string, config: ToolConfig, handler: ToolHandler): void;
};

const traceListSchema = {
  limit: z
    .number()
    .int()
    .min(1)
    .max(25)
    .optional()
    .describe("Maximum traces to return. Defaults to 10. Maximum 25."),
  query: z
    .string()
    .optional()
    .describe("Optional trace name or trace ID search string."),
  actor: z.string().optional().describe("Optional agent_id filter."),
  outcome: z
    .enum(["ok", "error"])
    .optional()
    .describe("Optional trace outcome filter."),
};

const traceIdSchema = {
  traceId: z.string().describe("AgentRail trace ID."),
};

const payloadStatusSchema = {
  traceId: z.string().describe("AgentRail trace ID."),
  spanId: z.string().describe("AgentRail span ID."),
};

const openDashboardSchema = {
  traceId: z
    .string()
    .optional()
    .describe("Optional AgentRail trace ID to open directly."),
};

export function registerAgentRailMcpTools(
  registrar: AgentRailToolRegistrar,
  dependencies: AgentRailToolDependencies,
): void {
  const handlers = createAgentRailToolHandlers(dependencies);

  registrar.registerTool(
    "agentrail_list_traces",
    {
      description:
        "Read-only: list recent AgentRail traces for the configured project.",
      inputSchema: traceListSchema,
    },
    handlers.agentrail_list_traces,
  );

  registrar.registerTool(
    "agentrail_get_trace",
    {
      description:
        "Read-only: inspect one AgentRail trace with ordered spans and payload availability metadata.",
      inputSchema: traceIdSchema,
    },
    handlers.agentrail_get_trace,
  );

  registrar.registerTool(
    "agentrail_get_actions",
    {
      description:
        "Read-only: list action and tool spans recorded in one AgentRail trace.",
      inputSchema: traceIdSchema,
    },
    handlers.agentrail_get_actions,
  );

  registrar.registerTool(
    "agentrail_get_payload_status",
    {
      description:
        "Read-only: check whether recorded data exists for a span without returning raw payload content.",
      inputSchema: payloadStatusSchema,
    },
    handlers.agentrail_get_payload_status,
  );

  registrar.registerTool(
    "agentrail_open_dashboard",
    {
      description:
        "Read-only: return a dashboard URL for the trace archive or one trace.",
      inputSchema: openDashboardSchema,
    },
    handlers.agentrail_open_dashboard,
  );
}

export function createAgentRailMcpServer(
  dependencies: AgentRailToolDependencies,
): McpServer {
  const server = new McpServer({
    name: "agentrail",
    version: "0.1.0",
  });

  registerAgentRailMcpTools(
    {
      registerTool(name, config, handler) {
        server.registerTool(name, config, async (input) => handler(input));
      },
    },
    dependencies,
  );

  return server;
}

function dependenciesFromConfig(
  config: AgentRailMcpConfig,
): AgentRailToolDependencies {
  const readModel = createDatabaseReadModel(config);
  return config.dashboardUrl === undefined
    ? { readModel }
    : { readModel, dashboardUrl: config.dashboardUrl };
}

export async function main(
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const config = createEnvironmentConfig(env);
  const server = createAgentRailMcpServer(dependenciesFromConfig(config));
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

export function reportStartupError(error: unknown): void {
  console.error(safeErrorMessage(error));
}
