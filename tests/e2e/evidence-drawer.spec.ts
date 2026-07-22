import { expect, test } from "@playwright/test";

import { sampleLlmSpanId, sampleTraceId } from "./sample-state";

test("loads private evidence through the backend and restores rail focus", async ({
  page,
}) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto(`/traces/${sampleTraceId}`);
  const origin = page.getByRole("link", { name: /draft answer, llm/i });

  await origin.click();

  await expect(page).toHaveURL(new RegExp(`span=${sampleLlmSpanId}$`));
  await expect(
    page.getByRole("dialog", { name: /evidence for draft answer/i }),
  ).toBeVisible();
  await expect(page.getByText(/sensitive fields were redacted/i)).toBeVisible();
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
  await expect(
    page.locator(`[data-span-id="${sampleLlmSpanId}"]`),
  ).toBeFocused();
});
