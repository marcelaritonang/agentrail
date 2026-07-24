import type { AgentRailToolDependencies, AgentRailToolResult } from "./types";

export const AGENTRAIL_MCP_TOOL_NAMES = [
  "agentrail_list_traces",
  "agentrail_get_trace",
  "agentrail_get_actions",
  "agentrail_get_payload_status",
  "agentrail_open_dashboard",
] as const;

export type AgentRailMcpToolName = (typeof AGENTRAIL_MCP_TOOL_NAMES)[number];

export type AgentRailToolHandlers = Record<
  AgentRailMcpToolName,
  (input: Record<string, unknown>) => Promise<AgentRailToolResult>
>;

export function createTextResult(value: unknown): AgentRailToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
  };
}

export function createAgentRailToolHandlers(
  _dependencies: AgentRailToolDependencies,
): AgentRailToolHandlers {
  const notImplemented = async () =>
    createTextResult({ error: "AGENTRAIL_MCP_TOOL_NOT_IMPLEMENTED" });

  return {
    agentrail_list_traces: notImplemented,
    agentrail_get_trace: notImplemented,
    agentrail_get_actions: notImplemented,
    agentrail_get_payload_status: notImplemented,
    agentrail_open_dashboard: notImplemented,
  };
}
