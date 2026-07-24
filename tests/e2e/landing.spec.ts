import { expect, test } from "@playwright/test";

test("renders the AgentRail landing page without fake-product overflow", async ({
  page,
}) => {
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
    page.getByRole("link", { name: "Explore the guided demo" }),
  ).toHaveAttribute("href", "/traces");
  await expect(page.getByText("Investigate")).toBeVisible();
  await expect(page.getByText("Replay")).toHaveCount(0);
  await expect(page.getByText(/AWS startup application/i)).toHaveCount(0);
  await expect(page.getByText(/pnpm add @agentrail\/sdk/i)).toHaveCount(0);
  await expect(page.getByRole("link", { name: /source/i })).toHaveCount(0);
  await expect(page.getByText(/robot|emoji|next-gen|unleash/i)).toHaveCount(0);

  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});
