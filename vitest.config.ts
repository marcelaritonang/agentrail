import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@agentrail-sdk/blob": fileURLToPath(
        new URL("./packages/blob/src/index.ts", import.meta.url),
      ),
      "@agentrail-sdk/config": fileURLToPath(
        new URL("./packages/config/src/index.ts", import.meta.url),
      ),
      "@agentrail-sdk/contracts": fileURLToPath(
        new URL("./packages/contracts/src/index.ts", import.meta.url),
      ),
      "@agentrail-sdk/context": fileURLToPath(
        new URL("./packages/context/src/index.ts", import.meta.url),
      ),
      "@agentrail-sdk/cli": fileURLToPath(
        new URL("./packages/cli/src/index.ts", import.meta.url),
      ),
      "@agentrail-sdk/db": fileURLToPath(
        new URL("./packages/db/src/index.ts", import.meta.url),
      ),
      "@agentrail-sdk/pricing": fileURLToPath(
        new URL("./packages/pricing/src/index.ts", import.meta.url),
      ),
      "@agentrail-sdk/queue": fileURLToPath(
        new URL("./packages/queue/src/index.ts", import.meta.url),
      ),
      "@agentrail-sdk/sdk": fileURLToPath(
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
