import { defineConfig } from "@playwright/test";

const baseURL = process.env.AGENTRAIL_WEB_URL ?? "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  outputDir: "test-results/playwright",
  use: {
    baseURL,
    browserName: "chromium",
    colorScheme: "dark",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { viewport: { width: 1440, height: 1000 } },
    },
    {
      name: "mobile",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: "pnpm --filter @agentrail/web dev",
    url: `${baseURL}/traces`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      DATABASE_URL:
        process.env.DATABASE_URL ??
        "postgresql://agentrail:agentrail@localhost:5433/agentrail_test",
      AGENTRAIL_PROJECT_ID:
        process.env.AGENTRAIL_PROJECT_ID ??
        "00000000-0000-4000-8000-000000000101",
      S3_ENDPOINT: process.env.S3_ENDPOINT ?? "http://localhost:9000",
      S3_REGION: process.env.S3_REGION ?? "us-east-1",
      S3_BUCKET: process.env.S3_BUCKET ?? "agentrail-evidence",
      S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID ?? "agentrail-local",
      S3_SECRET_ACCESS_KEY:
        process.env.S3_SECRET_ACCESS_KEY ?? "agentrail-local-secret",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
});
