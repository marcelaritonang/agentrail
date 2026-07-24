import { describe, expect, it } from "vitest";

import { createEnvironmentConfig } from "./read-model";

describe("AgentRail MCP read model configuration", () => {
  it("allows demo mode without database configuration", () => {
    expect(
      createEnvironmentConfig({
        AGENTRAIL_DEMO_MODE: "1",
        AGENTRAIL_DASHBOARD_URL: "https://agentrail.example/",
      }),
    ).toEqual({
      mode: "demo",
      dashboardUrl: "https://agentrail.example/",
    });
  });

  it("requires a database URL outside demo mode", () => {
    expect(() =>
      createEnvironmentConfig({
        AGENTRAIL_PROJECT_ID: "00000000-0000-4000-8000-000000000101",
      }),
    ).toThrow("DATABASE_URL is required for AgentRail MCP database mode");
  });

  it("requires a project id outside demo mode", () => {
    expect(() =>
      createEnvironmentConfig({
        DATABASE_URL:
          "postgresql://agentrail:secret@localhost:5433/agentrail_test",
      }),
    ).toThrow("AGENTRAIL_PROJECT_ID is required for AgentRail MCP database mode");
  });

  it("does not echo invalid database URLs in errors", () => {
    expect(() =>
      createEnvironmentConfig({
        DATABASE_URL: "not-a-valid-database-url",
        AGENTRAIL_PROJECT_ID: "00000000-0000-4000-8000-000000000101",
      }),
    ).toThrow("DATABASE_URL must be a valid URL");
  });
});
