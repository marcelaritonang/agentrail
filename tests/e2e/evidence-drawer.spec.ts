import { expect, test } from "@playwright/test";

import { sampleLlmSpanId, sampleTraceId } from "./sample-state";

test("loads recorded data through the backend and restores exact origin focus", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto(`/traces/${sampleTraceId}`);
  const origin = page.locator(
    `[data-span-id="${sampleLlmSpanId}"][data-evidence-origin="steps"]`,
  );
  await expect(origin).toHaveAccessibleName("Inspect recorded data");

  await origin.click();

  await expect(page).toHaveURL(new RegExp(`span=${sampleLlmSpanId}$`));
  await expect(
    page.getByRole("dialog", { name: "Recorded data for draft answer" }),
  ).toBeVisible();
  await expect(
    page.getByText("Sensitive fields were removed before storage."),
  ).toBeVisible();
  await expect(page.getByLabel("Captured payload JSON")).toContainText(
    "[REDACTED]",
  );
  expect(
    requests.some((url) =>
      /(?:localhost|127\.0\.0\.1):9000|minio|s3:\/\//i.test(url),
    ),
  ).toBe(false);

  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(`/traces/${sampleTraceId}`);
  await expect(origin).toBeFocused();

  const externalActions = page.getByRole("region", {
    name: "External actions",
  });
  await expect(
    externalActions.getByText("Metadata only", { exact: true }),
  ).toHaveCount(2);
  await expect(externalActions.getByRole("link")).toHaveCount(0);
});
