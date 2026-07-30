import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createContextRelay, type ContextRelay } from "@agentrail-sdk/context";

import {
  createDatabaseReadModel,
  createEnvironmentConfig,
  type AgentRailMcpConfig,
} from "./read-model.js";
import type {
  AgentRailToolDependencies,
  AgentRailToolResult,
} from "./types.js";
import { createAgentRailContextToolHandlers } from "./context-tools.js";
import {
  parseAgentRailMcpProfile,
  profileIncludesContext,
  profileIncludesForensics,
  type AgentRailMcpProfile,
} from "./profile.js";
import { createAgentRailToolHandlers, safeErrorMessage } from "./tools.js";

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

export type AgentRailMcpDependencies = Partial<AgentRailToolDependencies> & {
  relay?: ContextRelay;
  dashboardUrl?: string;
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
  dependencies: AgentRailMcpDependencies,
  profile: AgentRailMcpProfile = "forensics",
): void {
  if (profileIncludesContext(profile)) {
    if (dependencies.relay === undefined) {
      throw new Error("Context profile requires a Context Relay dependency.");
    }
    const contextHandlers = createAgentRailContextToolHandlers({
      relay: dependencies.relay,
    });

    registrar.registerTool(
      "agentrail_prepare_context",
      {
        description:
          "Read-only: prepare a bounded local Context Pack for the current coding task.",
        inputSchema: {
          task: z.string().min(1).max(2_000),
          tokenBudget: z.number().int().min(256).max(32_000),
          focus: z.array(z.string().min(1).max(100)).max(20).optional(),
          exclude: z.array(z.string().min(1).max(100)).max(20).optional(),
        },
      },
      contextHandlers.agentrail_prepare_context,
    );

    registrar.registerTool(
      "agentrail_recall",
      {
        description:
          "Read-only: recall local AgentRail memory records relevant to a task.",
        inputSchema: {
          query: z.string().min(1).max(2_000).optional(),
          tags: z.array(z.string().min(1).max(100)).max(20).optional(),
          limit: z.number().int().min(1).max(25).optional(),
        },
      },
      contextHandlers.agentrail_recall,
    );

    registrar.registerTool(
      "agentrail_remember",
      {
        description:
          "Write local-only memory: persist a project decision for future Context Packs.",
        inputSchema: {
          statement: z.string().min(1).max(2_000),
          tags: z.array(z.string().min(1).max(100)).max(20).optional(),
        },
      },
      contextHandlers.agentrail_remember,
    );

    registrar.registerTool(
      "agentrail_report_outcome",
      {
        description:
          "Write local-only receipt: record whether a Context Pack helped the task.",
        inputSchema: {
          packId: z.string().min(1).max(200),
          outcome: z.enum(["accepted", "rejected", "changed", "unknown"]),
          reason: z.string().min(1).max(1_000).optional(),
        },
      },
      contextHandlers.agentrail_report_outcome,
    );
  }

  if (!profileIncludesForensics(profile)) {
    return;
  }

  if (dependencies.readModel === undefined) {
    throw new Error("Forensics profile requires a read model dependency.");
  }

  const handlers = createAgentRailToolHandlers({
    readModel: dependencies.readModel,
    ...(dependencies.dashboardUrl === undefined
      ? {}
      : { dashboardUrl: dependencies.dashboardUrl }),
  });

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
  dependencies: AgentRailMcpDependencies,
  profile: AgentRailMcpProfile = "forensics",
): McpServer {
  const server = new McpServer({
    name: "agentrail",
    version: "0.1.2",
  });

  registerAgentRailMcpTools(
    {
      registerTool(name, config, handler) {
        server.registerTool(name, config, async (input) => handler(input));
      },
    },
    dependencies,
    profile,
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
  argv: readonly string[] = process.argv.slice(2),
): Promise<void> {
  const profile = profileFromArgs(argv, env);
  const dependencies: AgentRailMcpDependencies = {};

  if (profileIncludesContext(profile)) {
    dependencies.relay = createContextRelay({
      workspaceRoot: env.AGENTRAIL_WORKSPACE_ROOT ?? process.cwd(),
      privacyMode: privacyMode(env.AGENTRAIL_PRIVACY_MODE),
      client: env.AGENTRAIL_CLIENT ?? "mcp",
      packageVersion: "0.1.2",
      ...(env.AGENTRAIL_INSTALLATION_ID === undefined
        ? {}
        : { installationId: env.AGENTRAIL_INSTALLATION_ID }),
      ...(env.AGENTRAIL_DASHBOARD_URL === undefined
        ? {}
        : { dashboardUrl: env.AGENTRAIL_DASHBOARD_URL }),
    });
  }

  if (profileIncludesForensics(profile)) {
    Object.assign(dependencies, dependenciesFromConfig(createEnvironmentConfig(env)));
  }

  const server = createAgentRailMcpServer(dependencies, profile);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

export function reportStartupError(error: unknown): void {
  console.error(safeErrorMessage(error));
}

function profileFromArgs(
  argv: readonly string[],
  env: NodeJS.ProcessEnv,
): AgentRailMcpProfile {
  const profileIndex = argv.indexOf("--profile");
  const argProfile =
    profileIndex === -1 ? undefined : argv.at(profileIndex + 1);
  return parseAgentRailMcpProfile(argProfile ?? env.AGENTRAIL_MCP_PROFILE);
}

function privacyMode(
  value: string | undefined,
): "local-only" | "metrics-only" | "evidence-sync" {
  if (
    value === "local-only" ||
    value === "metrics-only" ||
    value === "evidence-sync"
  ) {
    return value;
  }
  return "local-only";
}
