import { describe, expect, it } from "vitest";

import { AGENTRAIL_FORENSICS_TOOL_NAMES } from "./tools.js";
import {
  CONTEXT_TOOL_NAMES,
  parseAgentRailMcpProfile,
  toolNamesForProfile,
} from "./profile.js";

describe("AgentRail MCP profiles", () => {
  it("defaults to the context profile with prepare_context as the first tool", () => {
    expect(parseAgentRailMcpProfile(undefined)).toBe("context");
    expect(toolNamesForProfile(parseAgentRailMcpProfile(undefined))).toEqual([
      "agentrail_prepare_context",
      "agentrail_recall",
      "agentrail_remember",
      "agentrail_report_outcome",
    ]);
  });

  it("maps exact tool names per profile", () => {
    expect(toolNamesForProfile("context")).toEqual(CONTEXT_TOOL_NAMES);
    expect(toolNamesForProfile("forensics")).toEqual(
      AGENTRAIL_FORENSICS_TOOL_NAMES,
    );
    expect(toolNamesForProfile("context+forensics")).toEqual([
      ...CONTEXT_TOOL_NAMES,
      ...AGENTRAIL_FORENSICS_TOOL_NAMES,
    ]);
  });
});
