import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { authSchema } from "@agentrail-sdk/db";
import { betterAuth, type BetterAuthOptions } from "better-auth";

import { database } from "./lib/control-database";

export type AuthEnvironment = {
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
};

export function readAuthEnvironment(
  env: Partial<Record<string, string | undefined>>,
): AuthEnvironment {
  return {
    BETTER_AUTH_SECRET: required(env, "BETTER_AUTH_SECRET"),
    BETTER_AUTH_URL: required(env, "BETTER_AUTH_URL"),
    GITHUB_CLIENT_ID: required(env, "GITHUB_CLIENT_ID"),
    GITHUB_CLIENT_SECRET: required(env, "GITHUB_CLIENT_SECRET"),
  };
}

export function createAuthOptions(input: {
  databaseAdapter: unknown;
  env: Partial<Record<string, string | undefined>>;
}): BetterAuthOptions {
  const env = readAuthEnvironment(input.env);

  return {
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    database: input.databaseAdapter as BetterAuthOptions["database"],
    socialProviders: {
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
      },
    },
    user: {
      additionalFields: {
        role: {
          type: "string",
          defaultValue: "member",
          input: false,
        },
      },
    },
  };
}

let authInstance: ReturnType<typeof betterAuth> | null = null;

export function getAuth(): ReturnType<typeof betterAuth> {
  authInstance ??= betterAuth(
    createAuthOptions({
      databaseAdapter: drizzleAdapter(database.db, {
        provider: "pg",
        schema: authSchema,
        transaction: true,
        usePlural: true,
      }),
      env: runtimeAuthEnvironment(),
    }),
  );
  return authInstance;
}

export const auth = new Proxy({} as ReturnType<typeof betterAuth>, {
  get(_target, property, receiver) {
    return Reflect.get(getAuth(), property, receiver);
  },
});

function required(
  env: Partial<Record<string, string | undefined>>,
  key: keyof AuthEnvironment,
): string {
  const value = env[key]?.trim();
  if (!value) {
    throw new Error(`${key} is required`);
  }
  return value;
}

function runtimeAuthEnvironment(): NodeJS.ProcessEnv {
  if (
    process.env.BETTER_AUTH_SECRET &&
    process.env.BETTER_AUTH_URL &&
    process.env.GITHUB_CLIENT_ID &&
    process.env.GITHUB_CLIENT_SECRET
  ) {
    return process.env;
  }

  if (process.env.NODE_ENV === "production") {
    return process.env;
  }

  return {
    ...process.env,
    BETTER_AUTH_SECRET:
      process.env.BETTER_AUTH_SECRET ?? "dev-only-agentrail-auth-secret",
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    GITHUB_CLIENT_ID:
      process.env.GITHUB_CLIENT_ID ?? "dev-only-github-client-id",
    GITHUB_CLIENT_SECRET:
      process.env.GITHUB_CLIENT_SECRET ?? "dev-only-github-client-secret",
  };
}
