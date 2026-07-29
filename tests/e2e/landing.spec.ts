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
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://agentrail.id",
  );
  await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute(
    "content",
    "AgentRail",
  );
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    "content",
    "summary_large_image",
  );
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
  const sourceUrl = process.env.NEXT_PUBLIC_AGENTRAIL_SOURCE_URL?.trim();
  const sourceLinks = page.getByRole("link", { name: /source/i });

  if (sourceUrl) {
    await expect(sourceLinks.first()).toHaveAttribute("href", sourceUrl);
  } else {
    await expect(sourceLinks).toHaveCount(0);
  }
  await expect(page.getByText(/robot|emoji|next-gen|unleash/i)).toHaveCount(0);

  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

test("serves public trust routes with stable navigation", async ({ page }) => {
  const routes = [
    { path: "/about", title: /About AgentRail/ },
    { path: "/architecture", title: /AgentRail Architecture/ },
    { path: "/founding-testers", title: /AgentRail Founding Testers/ },
    { path: "/privacy", title: /AgentRail Privacy/ },
    { path: "/security", title: /AgentRail Security/ },
    { path: "/terms", title: /AgentRail Terms/ },
  ] as const;

  for (const route of routes) {
    const response = await page.goto(route.path);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(route.title);
    await expect(page.locator("main h1")).toHaveCount(1);
    await expect(
      page.getByRole("link", { name: "AgentRail home" }),
    ).toHaveAttribute("href", "/");
    await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Docs" })).toHaveCount(0);
  }
});

test("serves the founding tester intake state truthfully", async ({ page }) => {
  const intakeUrl =
    process.env.NEXT_PUBLIC_AGENTRAIL_TESTER_INTAKE_URL?.trim() ?? "";

  await page.goto("/founding-testers");

  await expect(
    page.getByRole("heading", { level: 1, name: "AgentRail Founding Testers" }),
  ).toBeVisible();
  await expect(page.getByText("installation completed")).toBeVisible();
  await expect(page.getByText("first Context Pack created")).toBeVisible();
  await expect(page.getByText("returned within seven days")).toBeVisible();

  if (intakeUrl.length > 0) {
    await expect(
      page.getByRole("link", { name: "Open tester intake" }),
    ).toHaveAttribute("href", intakeUrl);
    await expect(page.getByText(/intake is being prepared/i)).toHaveCount(0);
  } else {
    await expect(page.getByText(/intake is being prepared/i)).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Open tester intake" }),
    ).toHaveCount(0);
  }
});
