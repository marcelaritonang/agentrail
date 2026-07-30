import { describe, expect, it } from "vitest";

type ReleaseVerifier = typeof import("../../scripts/verify-npm-release");

async function loadReleaseVerifier(): Promise<ReleaseVerifier> {
  const modulePath = "../../scripts/verify-npm-release";
  const loaded = await import(modulePath).catch(() => null);

  expect(
    loaded?.verifyNpmRelease,
    "the executable npm release verifier must exist",
  ).toBeTypeOf("function");

  return loaded as ReleaseVerifier;
}

describe("npm release smoke", () => {
  it("installs local tarballs without workspace protocols", async () => {
    const { verifyNpmRelease } = await loadReleaseVerifier();
    const result = await verifyNpmRelease({ mode: "tarball" });

    expect(result.sdkImport).toBe(true);
    expect(result.mcpInitialize).toBe(true);
    expect(result.cliHelp).toBe(true);
    expect(result.unresolvedWorkspaceDependencies).toEqual([]);
    expect(result.toolNames).toEqual([
      "agentrail_prepare_context",
      "agentrail_recall",
      "agentrail_remember",
      "agentrail_report_outcome",
    ]);
  }, 120_000);
});
