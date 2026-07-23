import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

import { sampleLlmSpanId, sampleTraceId } from "./sample-state";

test("captures the real forensic trace rail", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop",
    "The landing source uses the desktop rail",
  );
  await page.goto(`/traces/${sampleTraceId}`);

  await expect(
    page.getByRole("heading", { name: "What happened" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Technical timeline" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "External actions" }),
  ).toBeVisible();
  const llm = page.locator(
    `[data-span-id="${sampleLlmSpanId}"][data-evidence-origin="timeline"]`,
  );
  await llm.click();
  await expect(
    page.getByRole("dialog", { name: /recorded data for draft answer/i }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  const directory = resolve("artifacts/screenshots");
  mkdirSync(directory, { recursive: true });
  await page.screenshot({
    path: resolve(directory, "agentrail-trace-rail.png"),
    fullPage: false,
  });
});

test("uses deliberate mobile stacking without horizontal page overflow", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile",
    "Mobile-only composition check",
  );
  await page.goto(`/traces/${sampleTraceId}`);

  await expect(page.locator(".trace-rail-columns")).toBeHidden();
  await expect(page.locator(".action-mobile-list")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "What happened" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});
