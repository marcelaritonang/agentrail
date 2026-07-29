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
    expect(result.unresolvedWorkspaceDependencies).toEqual([]);
    expect(result.toolNames).toEqual([
      "agentrail_list_traces",
      "agentrail_get_trace",
      "agentrail_get_actions",
      "agentrail_get_payload_status",
      "agentrail_open_dashboard",
    ]);
  }, 120_000);
});
