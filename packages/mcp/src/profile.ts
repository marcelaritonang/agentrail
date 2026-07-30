import { AGENTRAIL_FORENSICS_TOOL_NAMES } from "./tools.js";

export type AgentRailMcpProfile = "context" | "forensics" | "context+forensics";

export const CONTEXT_TOOL_NAMES = [
  "agentrail_prepare_context",
  "agentrail_recall",
  "agentrail_remember",
  "agentrail_report_outcome",
] as const;

export type AgentRailContextToolName = (typeof CONTEXT_TOOL_NAMES)[number];

export function parseAgentRailMcpProfile(
  value: string | undefined,
): AgentRailMcpProfile {
  if (
    value === "context" ||
    value === "forensics" ||
    value === "context+forensics"
  ) {
    return value;
  }
  return "context";
}

export function profileIncludesContext(profile: AgentRailMcpProfile): boolean {
  return profile === "context" || profile === "context+forensics";
}

export function profileIncludesForensics(profile: AgentRailMcpProfile): boolean {
  return profile === "forensics" || profile === "context+forensics";
}

export function toolNamesForProfile(
  profile: AgentRailMcpProfile,
): readonly string[] {
  if (profile === "context") return CONTEXT_TOOL_NAMES;
  if (profile === "forensics") return AGENTRAIL_FORENSICS_TOOL_NAMES;
  return [...CONTEXT_TOOL_NAMES, ...AGENTRAIL_FORENSICS_TOOL_NAMES];
}
