import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const lambdaSourcePath = join(here, "lambda.ts");

describe("AWS Lambda ingest entrypoint", () => {
  it("exports a Hono AWS Lambda handler without replacing the existing app", async () => {
    expect(
      existsSync(lambdaSourcePath),
      "apps/ingest/src/lambda.ts should define the deployable Lambda entrypoint",
    ).toBe(true);

    const source = readFileSync(lambdaSourcePath, "utf8");

    expect(source).toContain('from "hono/aws-lambda"');
    expect(source).toContain("handle(app)");

    expect(source).toContain("export const handler = handle(app);");
  });
});
