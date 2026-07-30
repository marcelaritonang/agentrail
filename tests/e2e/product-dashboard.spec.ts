import { expect, test } from "@playwright/test";

test("requires sign-in before showing the hosted usage overview", async ({
  page,
}) => {
  await page.goto("/dashboard");

  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Sign in to activate AgentRail." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with GitHub" }),
  ).toBeVisible();
});

test("requires sign-in before showing connected integrations", async ({
  page,
}) => {
  await page.goto("/dashboard/integrations");

  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Project-scoped access" }),
  ).toBeVisible();
});

test("keeps the read-only trace archive available without hosted login", async ({
  page,
}) => {
  await page.goto("/traces");

  await expect(page).toHaveURL(/\/traces$/);
  await expect(page.getByRole("heading", { name: "Agent runs" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Explore the sample run" }),
  ).toBeVisible();
});
