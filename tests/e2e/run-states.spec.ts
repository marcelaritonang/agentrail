import { expect, test } from "@playwright/test";

import {
  incompleteTraceId,
  removeRunStateFixtures,
  seedRunStateFixtures,
  unpricedLlmSpanId,
  unpricedTraceId,
} from "./sample-state";

const dbBaseURL =
  process.env.AGENTRAIL_DB_WEB_URL ??
  process.env.AGENTRAIL_WEB_URL ??
  "http://127.0.0.1:3000";
const runStateFixturesEnabled =
  process.env.AGENTRAIL_DEMO_MODE?.trim().toLowerCase() === "0";

function dbPath(path: string) {
  return new URL(path, dbBaseURL).toString();
}

test.describe.configure({ mode: "serial" });
test.skip(
  !runStateFixturesEnabled,
  "DB run-state fixtures require AGENTRAIL_DEMO_MODE=0",
);

test.beforeAll(async () => {
  await seedRunStateFixtures();
});

test.afterAll(async () => {
  await removeRunStateFixtures();
});

test("explains an incomplete recording without live-status language", async ({
  page,
}) => {
  await page.goto(dbPath(`/traces/${incompleteTraceId}`));

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Fixture incomplete research",
    }),
  ).toBeVisible();
  await expect(page.getByText("Incomplete recording")).toBeVisible();
  await expect(page.getByText("This recording is incomplete.")).toBeVisible();
  await expect(page.getByText(/running|pending|live/i)).toHaveCount(0);
});

test("keeps unknown model pricing explicit and never renders zero cost", async ({
  page,
}) => {
  await page.goto(dbPath(`/traces/${unpricedTraceId}`));

  await expect(
    page.getByRole("heading", { level: 1, name: "Fixture unpriced answer" }),
  ).toBeVisible();
  await expect(page.getByText("Price unavailable")).toBeVisible();
  await expect(page.getByText("UNPRICED").first()).toBeVisible();
  await expect(page.getByText("$0.00")).toHaveCount(0);
});

test("renders not-found and filtered-empty states with approved language", async ({
  page,
}) => {
  await page.goto(dbPath("/traces/ffffffffffffffffffffffffffffffff"));

  await expect(
    page.getByRole("heading", { level: 1, name: "Run not found" }),
  ).toBeVisible();

  await page.goto(
    dbPath(
      "/traces?q=definitely-no-run-state-fixture&actor=no-such-agent&outcome=error",
    ),
  );

  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "No agent runs match these filters",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Clear filters" }),
  ).toHaveAttribute("href", "/traces");
});

test("keeps the trace usable when recorded data fails to load", async ({
  page,
}) => {
  await page.route(
    `**/api/traces/${unpricedTraceId}/payload/${unpricedLlmSpanId}`,
    async (route) => {
      await route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({ error: "fixture gateway failure" }),
      });
    },
  );
  await page.goto(dbPath(`/traces/${unpricedTraceId}`));

  const origin = page.locator(
    `[data-span-id="${unpricedLlmSpanId}"][data-evidence-origin="steps"]`,
  );
  await expect(origin).toHaveAccessibleName("Inspect recorded data");
  await origin.click();

  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByText("Recorded data couldn't be loaded."),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "What happened" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Technical timeline" }),
  ).toBeVisible();
});

test("removes database-only run-state fixtures after browser assertions", async ({
  page,
}) => {
  await removeRunStateFixtures();

  await page.goto(dbPath(`/traces/${incompleteTraceId}`));
  await expect(
    page.getByRole("heading", { level: 1, name: "Run not found" }),
  ).toBeVisible();

  await page.goto(dbPath(`/traces/${unpricedTraceId}`));
  await expect(
    page.getByRole("heading", { level: 1, name: "Run not found" }),
  ).toBeVisible();
});
