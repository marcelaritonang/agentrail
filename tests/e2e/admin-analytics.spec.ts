import { expect, test } from "@playwright/test";

test("requires sign-in before founder analytics are shown", async ({
  page,
}) => {
  await page.goto("/admin/analytics");

  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Sign in to activate AgentRail." }),
  ).toBeVisible();
});
