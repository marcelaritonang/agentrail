import { describe, expect, it } from "vitest";

import { AGENTRAIL_MCP_TOOL_NAMES } from "./tools";

describe("AgentRail MCP tools", () => {
  it("exposes only the approved read-only tools", () => {
    expect(AGENTRAIL_MCP_TOOL_NAMES).toEqual([
      "agentrail_list_traces",
      "agentrail_get_trace",
      "agentrail_get_actions",
      "agentrail_get_payload_status",
      "agentrail_open_dashboard",
    ]);
  });
});
