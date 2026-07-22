import { expect, test } from "@playwright/test";

test("lists the persisted sample trace without a running status", async ({
  page,
}, testInfo) => {
  await page.goto("/traces");

  await expect(
    page.getByRole("heading", { name: "Trace archive" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "sample.research-answer" }).first(),
  ).toBeVisible();
  await expect(page.getByText(/running/i)).toHaveCount(0);

  if (testInfo.project.name === "mobile") {
    await expect(page.locator(".trace-mobile-list")).toBeVisible();
    await expect(page.locator(".trace-table-wrap")).toBeHidden();
  } else {
    await expect(
      page.getByRole("table", { name: "Agent traces" }),
    ).toBeVisible();
  }

  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});
