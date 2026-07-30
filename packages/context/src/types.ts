import { z } from "zod";

export type SourceTrust =
  | "trusted_instruction"
  | "project_source"
  | "project_documentation"
  | "project_memory"
  | "untrusted_content";

export type ContextWarningCode =
  | "partial_index"
  | "file_limit"
  | "file_too_large"
  | "binary_excluded"
  | "secret_excluded"
  | "symlink_escape"
  | "cache_rebuilt"
  | "budget_too_small"
  | "spool_overflow";

export type ContextWarning = {
  code: ContextWarningCode;
  detail: string;
};

export type ProjectMemoryRecord = {
  id: string;
  recordedAt: string;
  source: "user" | "agent" | "outcome";
  statement: string;
  tags: readonly string[];
};

const shortStringSchema = z.string().min(1).max(100);

export const ContextPackRequestSchema = z.object({
  task: z.string().min(1).max(2_000),
  tokenBudget: z.number().int().min(256).max(32_000),
  focus: z.array(shortStringSchema).max(20).optional(),
  exclude: z.array(shortStringSchema).max(20).optional(),
});

export type ContextPackRequest = {
  task: string;
  tokenBudget: number;
  focus?: readonly string[];
  exclude?: readonly string[];
};

export type ContextItem = {
  sourceId: string;
  path: string;
  locator: { startLine: number; endLine: number; symbol: string | null };
  content: string;
  contentHash: string;
  trust: SourceTrust;
  reasons: readonly string[];
  score: number;
  freshness: string;
  estimatedTokens: number;
  truncated: boolean;
};

export type ContextMeasurement = {
  candidateTokensEstimate: number;
  returnedTokensEstimate: number;
  contextReductionEstimate: number;
  method: "heuristic-v1";
  confidence: "estimated";
};

export type ContextPack = {
  packId: string;
  status: "ready" | "partial" | "empty";
  context: readonly ContextItem[];
  decisions: readonly ProjectMemoryRecord[];
  warnings: readonly ContextWarning[];
  measurement: ContextMeasurement;
  receiptUrl: string | null;
};

export function relativeContextPath(input: string): string {
  if (input.length === 0) {
    throw new Error("Context path must not be empty.");
  }
  if (input.includes("\0")) {
    throw new Error("Context path must not contain NUL bytes.");
  }
  if (input.includes("\\")) {
    throw new Error("Context path must use forward slashes.");
  }
  if (input.startsWith("/") || /^[A-Za-z]:/.test(input)) {
    throw new Error("Context path must be relative.");
  }
  const segments = input.split("/");
  if (
    segments.some(
      (segment) => segment.length === 0 || segment === "." || segment === "..",
    )
  ) {
    throw new Error("Context path must be normalized.");
  }
  return input;
}
