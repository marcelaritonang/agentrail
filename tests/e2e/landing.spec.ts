import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

test("renders the AgentRail landing page without fake-product overflow", async ({
  page,
}, testInfo) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1, name: "AgentRail" }),
  ).toBeVisible();
  await expect(
    page.getByText(/The flight recorder for AI agents\./),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: /real Trace Rail screenshot/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open trace dashboard" }),
  ).toHaveAttribute("href", "/traces");
  await expect(page.getByText(/robot|emoji|next-gen|unleash/i)).toHaveCount(0);

  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);

  const directory = resolve("artifacts/screenshots");
  mkdirSync(directory, { recursive: true });
  await page.screenshot({
    path: resolve(directory, `agentrail-landing-${testInfo.project.name}.png`),
    fullPage: true,
  });
});
