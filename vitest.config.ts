import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: [
            "packages/**/*.test.ts",
            "apps/**/*.test.ts",
            "tests/**/*.test.ts",
          ],
        },
      },
    ],
  },
});
