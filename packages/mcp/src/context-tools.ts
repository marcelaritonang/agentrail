import type {
  ContextRelay,
  ContextPackRequest,
  OutcomeRequest,
  RecallRequest,
  RememberRequest,
} from "@agentrail-sdk/context";

import type { AgentRailToolResult } from "./types.js";
import {
  CONTEXT_TOOL_NAMES,
  type AgentRailContextToolName,
} from "./profile.js";
import { createTextResult } from "./tools.js";

export type AgentRailContextToolDependencies = {
  relay: ContextRelay;
};

export type AgentRailContextToolHandlers = Record<
  AgentRailContextToolName,
  (input: Record<string, unknown>) => Promise<AgentRailToolResult>
>;

export { CONTEXT_TOOL_NAMES };

export function createAgentRailContextToolHandlers(
  dependencies: AgentRailContextToolDependencies,
): AgentRailContextToolHandlers {
  return {
    async agentrail_prepare_context(input) {
      const focus = stringList(input.focus, "focus");
      const exclude = stringList(input.exclude, "exclude");
      const request: ContextPackRequest = {
        task: requiredString(input.task, "task", 2_000),
        tokenBudget: integerInRange(
          input.tokenBudget,
          "tokenBudget",
          256,
          32_000,
        ),
        ...(focus === undefined ? {} : { focus }),
        ...(exclude === undefined ? {} : { exclude }),
      };
      const pack = await dependencies.relay.prepareContext(request);
      return createTextResult({ pack });
    },
    async agentrail_recall(input) {
      const query = optionalString(input.query, "query", 2_000);
      const tags = stringList(input.tags, "tags");
      const request: RecallRequest = {
        ...(query === undefined ? {} : { query }),
        ...(tags === undefined ? {} : { tags }),
        ...(input.limit === undefined
          ? {}
          : { limit: integerInRange(input.limit, "limit", 1, 25) }),
      };
      const records = await dependencies.relay.recall(request);
      return createTextResult({ records });
    },
    async agentrail_remember(input) {
      const tags = stringList(input.tags, "tags");
      const type = optionalMemoryType(input.type);
      const scope = optionalString(input.scope, "scope", 200);
      const expiresAt = optionalString(input.expiresAt, "expiresAt", 100);
      const request: RememberRequest = {
        statement: requiredString(input.statement, "statement", 2_000),
        ...(type === undefined ? {} : { type }),
        ...(scope === undefined ? {} : { scope }),
        ...(expiresAt === undefined ? {} : { expiresAt }),
        ...(tags === undefined ? {} : { tags }),
      };
      const record = await dependencies.relay.remember(request);
      return createTextResult({ record });
    },
    async agentrail_report_outcome(input) {
      const outcome = input.outcome;
      if (
        outcome !== "accepted" &&
        outcome !== "rejected" &&
        outcome !== "changed" &&
        outcome !== "unknown"
      ) {
        return createTextResult({
          error:
            "outcome must be one of accepted, rejected, changed, or unknown",
        });
      }
      const reason = optionalString(input.reason, "reason", 1_000);
      const request: OutcomeRequest = {
        packId: requiredString(input.packId, "packId", 200),
        outcome,
        ...(reason === undefined ? {} : { reason }),
      };
      const receipt = await dependencies.relay.reportOutcome(request);
      return createTextResult({ receipt });
    },
  };
}

function requiredString(input: unknown, field: string, max: number): string {
  const value = optionalString(input, field, max);
  if (value === undefined) {
    throw new Error(`${field} is required`);
  }
  return value;
}

function optionalString(
  input: unknown,
  field: string,
  max: number,
): string | undefined {
  if (input === undefined || input === null) return undefined;
  if (typeof input !== "string") {
    throw new Error(`${field} must be a string`);
  }
  const trimmed = input.trim();
  if (trimmed.length === 0 || trimmed.length > max) {
    throw new Error(`${field} must be between 1 and ${max} characters`);
  }
  return trimmed;
}

function stringList(
  input: unknown,
  field: string,
): readonly string[] | undefined {
  if (input === undefined || input === null) return undefined;
  if (!Array.isArray(input)) {
    throw new Error(`${field} must be an array`);
  }
  if (input.length > 20) {
    throw new Error(`${field} can contain at most 20 items`);
  }
  return input.map((item) => requiredString(item, field, 100));
}

function optionalMemoryType(input: unknown): RememberRequest["type"] {
  if (input === undefined || input === null) return undefined;
  if (
    input === "architecture" ||
    input === "constraint" ||
    input === "convention" ||
    input === "rejected_approach" ||
    input === "risk" ||
    input === "workaround"
  ) {
    return input;
  }
  throw new Error("type must be a valid AgentRail memory type");
}

function integerInRange(
  input: unknown,
  field: string,
  min: number,
  max: number,
): number {
  if (typeof input !== "number" || !Number.isInteger(input)) {
    throw new Error(`${field} must be an integer`);
  }
  if (input < min || input > max) {
    throw new Error(`${field} must be between ${min} and ${max}`);
  }
  return input;
}
