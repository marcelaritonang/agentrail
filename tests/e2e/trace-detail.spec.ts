import { expect, test } from "@playwright/test";

import {
  sampleActionTitle,
  sampleAgentId,
  sampleLlmSpanId,
  sampleTraceId,
} from "./sample-state";

function textPattern(value: string) {
  return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}

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
  await expect(llmRow).toContainText(sampleAgentId);
  if (testInfo.project.name === "mobile") {
    await expect(
      page
        .locator(".action-mobile-list")
        .getByText(textPattern(sampleActionTitle)),
    ).toBeVisible();
  } else {
    await expect(
      page.getByRole("cell", { name: textPattern(sampleActionTitle) }),
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

test("wraps long at-a-glance identifiers without clipping", async ({
  page,
}) => {
  await page.setViewportSize({ width: 640, height: 800 });
  await page.goto(`/traces/${sampleTraceId}`);
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });

  const agentFact = page.locator(".trace-facts dd").nth(1);
  await agentFact.evaluate((element) => {
    element.textContent =
      "agent_" + "0123456789abcdefghijklmnopqrstuvwxyz".repeat(5);
  });

  const metrics = await agentFact.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      overflow: style.overflow,
      textOverflow: style.textOverflow,
      whiteSpace: style.whiteSpace,
    };
  });

  expect(metrics.overflow).not.toBe("hidden");
  expect(metrics.textOverflow).not.toBe("ellipsis");
  expect(metrics.whiteSpace).not.toBe("nowrap");
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
});
