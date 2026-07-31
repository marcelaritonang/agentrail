import { createInterface } from "node:readline/promises";
import { env, stdin, stdout } from "node:process";

import { and, eq } from "drizzle-orm";

import { accounts, createDatabase, users } from "@agentrail-sdk/db";

type GrantAdminArgs = {
  email: string;
  githubAccountId: string;
};

async function main(): Promise<void> {
  if (env.CI === "true") {
    throw new Error("grant-admin is interactive and must not run in CI");
  }

  const args = parseArgs(process.argv.slice(2));
  const databaseUrl = env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const database = createDatabase(databaseUrl);
  try {
    const [match] = await database.db
      .select({
        userId: users.id,
        email: users.email,
        role: users.role,
        githubAccountId: accounts.accountId,
      })
      .from(users)
      .innerJoin(accounts, eq(accounts.userId, users.id))
      .where(
        and(
          eq(users.email, args.email),
          eq(accounts.providerId, "github"),
          eq(accounts.accountId, args.githubAccountId),
        ),
      )
      .limit(1);

    if (match === undefined) {
      throw new Error(
        "No user matched that exact email and GitHub account id.",
      );
    }

    if (match.role === "admin") {
      stdout.write(`${match.email} is already an admin.\n`);
      return;
    }

    const expectedConfirmation = `GRANT ADMIN ${match.email}`;
    const readline = createInterface({ input: stdin, output: stdout });
    try {
      const answer = await readline.question(
        `Type "${expectedConfirmation}" to grant admin role: `,
      );
      if (answer !== expectedConfirmation) {
        throw new Error("Confirmation did not match; no changes were made.");
      }
    } finally {
      readline.close();
    }

    await database.db
      .update(users)
      .set({
        role: "admin",
        updatedAt: new Date(),
      })
      .where(eq(users.id, match.userId));

    stdout.write(`Granted admin role to ${match.email}.\n`);
  } finally {
    await database.close();
  }
}

function parseArgs(argv: readonly string[]): GrantAdminArgs {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag === "--email" || flag === "--github-account-id") {
      if (value === undefined || value.startsWith("--")) {
        throw new Error(`${flag} requires a value`);
      }
      values.set(flag, value);
      index += 1;
    }
  }

  const email = values.get("--email")?.trim().toLowerCase();
  const githubAccountId = values.get("--github-account-id")?.trim();

  if (!email || !githubAccountId) {
    throw new Error(
      "Usage: pnpm admin:grant --email founder@agentrail.id --github-account-id <github-subject>",
    );
  }

  return {
    email,
    githubAccountId,
  };
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
