import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema.js";

export type AgentRailDatabase = PostgresJsDatabase<typeof schema>;
export type SqlClient = ReturnType<typeof postgres>;

export type DatabaseConnection = {
  db: AgentRailDatabase;
  sql: SqlClient;
  close: () => Promise<void>;
};

export function createDatabase(connectionString: string): DatabaseConnection {
  const sql = postgres(connectionString, { max: 10 });

  return {
    db: drizzle(sql, { schema }),
    sql,
    close: async () => {
      await sql.end({ timeout: 5 });
    },
  };
}
