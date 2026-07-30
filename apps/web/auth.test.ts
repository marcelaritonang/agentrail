import { describe, expect, it } from "vitest";

import { createAuthOptions, readAuthEnvironment } from "./auth";

const validEnv = {
  BETTER_AUTH_SECRET: "test-secret-with-enough-entropy",
  BETTER_AUTH_URL: "https://agentrail.id",
  GITHUB_CLIENT_ID: "github-client-id",
  GITHUB_CLIENT_SECRET: "github-client-secret",
};

describe("AgentRail auth configuration", () => {
  it("requires server-only auth and GitHub secrets", () => {
    expect(() => readAuthEnvironment({})).toThrow("BETTER_AUTH_SECRET");
    expect(() =>
      readAuthEnvironment({
        BETTER_AUTH_SECRET: validEnv.BETTER_AUTH_SECRET,
        BETTER_AUTH_URL: validEnv.BETTER_AUTH_URL,
      }),
    ).toThrow("GITHUB_CLIENT_ID");
  });

  it("builds GitHub-only Better Auth options with a non-input role field", () => {
    const options = createAuthOptions({
      databaseAdapter: { adapter: "drizzle" },
      env: validEnv,
    });

    expect(options.secret).toBe(validEnv.BETTER_AUTH_SECRET);
    expect(options.baseURL).toBe(validEnv.BETTER_AUTH_URL);
    expect(options.socialProviders).toEqual({
      github: {
        clientId: validEnv.GITHUB_CLIENT_ID,
        clientSecret: validEnv.GITHUB_CLIENT_SECRET,
      },
    });
    expect(options.user).toEqual({
      additionalFields: {
        role: {
          type: "string",
          defaultValue: "member",
          input: false,
        },
      },
    });
    expect("emailAndPassword" in options).toBe(false);
  });
});
