import { describe, expect, it } from "vitest";

import { AGENTRAIL_FORENSICS_TOOL_NAMES } from "./tools.js";
import { CONTEXT_TOOL_NAMES, toolNamesForProfile } from "./profile.js";

describe("AgentRail MCP profiles", () => {
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
