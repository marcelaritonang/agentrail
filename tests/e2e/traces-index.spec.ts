import { expect, test } from "@playwright/test";

test("lists the persisted sample trace without a running status", async ({
  page,
}, testInfo) => {
  await page.goto("/traces");

  await expect(
    page.getByRole("heading", { level: 1, name: "Agent runs" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Research answer" }).first(),
  ).toBeVisible();
  await expect(
    page.getByRole("list", { name: "How to inspect an agent run" }),
  ).toBeVisible();
  await expect(page.getByText(/running/i)).toHaveCount(0);

  if (testInfo.project.name === "mobile") {
    await expect(page.getByText("Search and filters")).toBeVisible();
    await expect(page.locator(".trace-table thead")).toBeHidden();
    await expect(
      page.getByRole("link", { name: "Open run" }).first(),
    ).toHaveCSS("min-height", "44px");
  } else {
    await expect(page.getByText("Search and filters")).toBeHidden();
    await expect(page.getByRole("table", { name: "Agent runs" })).toBeVisible();
  }

  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

test("keeps the 390px run ledger operable without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/traces");

  await expect(page.getByText("Search and filters")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open run" }).first(),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});
