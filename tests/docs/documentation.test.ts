import { access, readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const required = [
  "README.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "LICENSE",
  "docs/architecture.md",
  "docs/deployment/aws.md",
  "docs/operations/api-keys.md",
];

describe("open-source documentation", () => {
  it("contains every required public document", async () => {
    await Promise.all(required.map((path) => access(path)));
  });

  it("documents canonical idempotency and 202 semantics", async () => {
    const architecture = await readFile("docs/architecture.md", "utf8");
    expect(architecture).toContain("(project_id, span_id)");
    expect(architecture).toContain("202 Accepted");
    expect(architecture).toContain("queue acknowledgment");
  });

  it("states the project maturity without funding or production guarantees", async () => {
    const readme = await readFile("README.md", "utf8");
    const aws = await readFile("docs/deployment/aws.md", "utf8");
    expect(readme).toContain("Milestone 1");
    expect(aws).toContain("reference mapping");
    expect(aws).toContain("does not guarantee");
  });
});
