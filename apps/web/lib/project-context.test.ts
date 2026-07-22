import { afterEach, describe, expect, it, vi } from "vitest";

import { DEMO_PROJECT_ID } from "./demo-mode";
import { configuredProjectId } from "./project-context";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("configuredProjectId", () => {
  it("uses the public demo project when demo mode is enabled", () => {
    vi.stubEnv("AGENTRAIL_DEMO_MODE", "1");
    vi.stubEnv("AGENTRAIL_PROJECT_ID", undefined);

    expect(configuredProjectId()).toBe(DEMO_PROJECT_ID);
  });

  it("still requires an explicit project id outside demo mode", () => {
    vi.stubEnv("AGENTRAIL_DEMO_MODE", undefined);
    vi.stubEnv("AGENTRAIL_PROJECT_ID", undefined);

    expect(() => configuredProjectId()).toThrow(
      "AGENTRAIL_PROJECT_ID must be a valid UUID",
    );
  });
});
