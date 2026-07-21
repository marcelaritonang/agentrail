import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./migrations",
  dbCredentials: {
    url:
      process.env.POSTGRES_URL ??
      "postgresql://agentrail:agentrail@localhost:5433/agentrail_test",
  },
});
