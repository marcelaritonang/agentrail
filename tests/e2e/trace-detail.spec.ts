import { expect, test } from "@playwright/test";

import { sampleLlmSpanId, sampleTraceId } from "./sample-state";

test("composes the persisted trace rail and action ledger", async ({
  page,
}, testInfo) => {
  await page.goto(`/traces/${sampleTraceId}`);

  await expect(
    page.getByRole("heading", { level: 1, name: "Research answer" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "What happened" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Technical timeline" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "External actions" }),
  ).toBeVisible();
  const llmRow = page
    .locator(".span-row")
    .filter({ has: page.locator(`[data-span-id="${sampleLlmSpanId}"]`) });
  await expect(llmRow).toContainText("draft answer");
  await expect(llmRow).toContainText("sample-research-agent");
  if (testInfo.project.name === "mobile") {
    await expect(
      page.locator(".action-mobile-list").getByText(/filesystem read/i),
    ).toBeVisible();
  } else {
    await expect(
      page.getByRole("cell", { name: /filesystem.read/i }),
    ).toBeVisible();
  }
  await expect(page.getByText(/running/i)).toHaveCount(0);
  await expect(page.getByText(/succeeded/i).first()).toBeVisible();

  const sectionHeadings = await page.locator("main h2").allTextContents();
  expect(sectionHeadings).toEqual([
    "What happened",
    "Technical timeline",
    "External actions",
  ]);
});

test("remains operable at 200 percent browser zoom", async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 800 });
  await page.goto(`/traces/${sampleTraceId}`);
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });

  const action = page
    .locator('[data-evidence-origin="steps"]')
    .filter({ hasText: "Inspect recorded data" })
    .first();
  await expect(action).toBeVisible();
  const box = await action.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(640);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});
