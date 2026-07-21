import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@agentrail/blob": fileURLToPath(
        new URL("./packages/blob/src/index.ts", import.meta.url),
      ),
      "@agentrail/config": fileURLToPath(
        new URL("./packages/config/src/index.ts", import.meta.url),
      ),
      "@agentrail/contracts": fileURLToPath(
        new URL("./packages/contracts/src/index.ts", import.meta.url),
      ),
      "@agentrail/db": fileURLToPath(
        new URL("./packages/db/src/index.ts", import.meta.url),
      ),
      "@agentrail/pricing": fileURLToPath(
        new URL("./packages/pricing/src/index.ts", import.meta.url),
      ),
      "@agentrail/queue": fileURLToPath(
        new URL("./packages/queue/src/index.ts", import.meta.url),
      ),
      "@agentrail/sdk": fileURLToPath(
        new URL("./packages/sdk/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    fileParallelism: false,
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: [
            "packages/**/*.test.ts",
            "packages/**/*.test.tsx",
            "apps/**/*.test.ts",
            "apps/**/*.test.tsx",
            "tests/**/*.test.ts",
            "tests/**/*.test.tsx",
          ],
        },
      },
    ],
  },
});
