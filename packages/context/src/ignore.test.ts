import { describe, expect, it } from "vitest";

import { createWorkspaceIgnore } from "./ignore.js";

describe("workspace ignore rules", () => {
  it("excludes dependency, build, secret, gitignore, agentrailignore, and explicit rules", () => {
    const rules = createWorkspaceIgnore({
      gitignore: "ignored.tmp\n",
      agentrailignore: "docs/private/**\n",
      exclude: ["generated/**"],
    });

    expect(rules.ignores("src/app.ts")).toBe(false);
    expect(rules.ignores("docs/guide.md")).toBe(false);
    expect(rules.ignores("node_modules/pkg/index.js")).toBe(true);
    expect(rules.ignores("dist/generated.js")).toBe(true);
    expect(rules.ignores(".env")).toBe(true);
    expect(rules.ignores(".env.local")).toBe(true);
    expect(rules.ignores(".npmrc")).toBe(true);
    expect(rules.ignores("id_rsa")).toBe(true);
    expect(rules.ignores("server.pem")).toBe(true);
    expect(rules.ignores("aws/credentials")).toBe(true);
    expect(rules.ignores("ignored.tmp")).toBe(true);
    expect(rules.ignores("docs/private/notes.md")).toBe(true);
    expect(rules.ignores("generated/types.ts")).toBe(true);
  });
});
