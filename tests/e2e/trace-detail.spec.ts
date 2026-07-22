import { expect, test } from "@playwright/test";

import { sampleTraceId } from "./sample-state";

test("composes the persisted trace rail and action ledger", async ({
  page,
}, testInfo) => {
  await page.goto(`/traces/${sampleTraceId}`);

  await expect(
    page.getByRole("heading", { name: "sample.research-answer" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Trace Rail" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Action Ledger" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /draft answer, llm/i }),
  ).toContainText("sample-research-agent");
  if (testInfo.project.name === "mobile") {
    await expect(
      page.locator(".action-mobile-list").getByText("filesystem.read"),
    ).toBeVisible();
  } else {
    await expect(
      page.getByRole("cell", { name: /filesystem.read/i }),
    ).toBeVisible();
  }
  await expect(page.getByText(/running/i)).toHaveCount(0);
});
