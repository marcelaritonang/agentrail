import { copyFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

import { sampleLlmSpanId, sampleTraceId } from "./sample-state";

const screenshotDirectory = resolve("artifacts/screenshots");
const traceRailCapture = resolve(
  screenshotDirectory,
  "agentrail-trace-rail.png",
);
const publicTraceRail = resolve(
  "apps/web/public/landing/agentrail-trace-rail.png",
);

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

  mkdirSync(screenshotDirectory, { recursive: true });
  await page.screenshot({
    path: traceRailCapture,
    fullPage: false,
  });
  copyFileSync(traceRailCapture, publicTraceRail);
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

test("captures the landing page desktop evidence", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop",
    "Desktop-only landing capture",
  );
  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1, name: "AgentRail" }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: /real Trace Rail screenshot/i }),
  ).toBeVisible();
  await expect(page.locator(".landing-hero-copy")).toHaveCSS("opacity", "1");
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);

  mkdirSync(screenshotDirectory, { recursive: true });
  await page.screenshot({
    path: resolve(screenshotDirectory, "agentrail-landing-desktop.png"),
    fullPage: true,
  });
});

test("captures the landing page mobile evidence", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile-only landing capture");
  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1, name: "AgentRail" }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: /real Trace Rail screenshot/i }),
  ).toBeVisible();
  await expect(page.locator(".landing-hero-copy")).toHaveCSS("opacity", "1");
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);

  mkdirSync(screenshotDirectory, { recursive: true });
  await page.screenshot({
    path: resolve(screenshotDirectory, "agentrail-landing-mobile.png"),
    fullPage: true,
  });
});
