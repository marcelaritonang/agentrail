import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

import { sampleLlmSpanId, sampleTraceId } from "./sample-state";

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    results.violations.map((violation) => ({
      id: violation.id,
      targets: violation.nodes.map((node) => node.target),
    })),
  ).toEqual([]);
}

async function tabUntilFocused(page: Page, target: Locator) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await page.keyboard.press("Tab");
    if (
      await target.evaluate((element) => element === document.activeElement)
    ) {
      return;
    }
  }
  throw new Error(`Tab did not reach ${await target.textContent()}`);
}

async function expectNamedControls(page: Page) {
  const controls = page.locator(
    "a[href]:visible, button:visible, input:visible, select:visible, summary:visible",
  );
  for (let index = 0; index < (await controls.count()); index += 1) {
    await expect(controls.nth(index)).toHaveAccessibleName(/\S/);
  }
}

test("has logical headings, named controls, and zero Axe violations on the index", async ({
  page,
}) => {
  await page.goto("/traces");

  await expectNamedControls(page);
  expect(await page.locator("main h1").count()).toBe(1);
  expect(await page.locator("main h3").count()).toBe(0);
  await expectNoAxeViolations(page);
});

test("has logical headings, named controls, and zero Axe violations on detail", async ({
  page,
}) => {
  await page.goto(`/traces/${sampleTraceId}`);

  await expectNamedControls(page);
  expect(await page.locator("main h1").count()).toBe(1);
  const levels = await page
    .locator("main h1, main h2, main h3")
    .evaluateAll((headings) =>
      headings.map((heading) => Number(heading.tagName.slice(1))),
    );
  expect(levels[0]).toBe(1);
  for (let index = 1; index < levels.length; index += 1) {
    expect(levels[index] - levels[index - 1]).toBeLessThanOrEqual(1);
  }
  await expectNoAxeViolations(page);
});

test("supports logical keyboard order on the run archive", async ({ page }) => {
  await page.goto("/traces");
  await page.locator("body").click({ position: { x: 2, y: 2 } });

  const sampleCta = page.getByRole("link", {
    name: "Explore the sample run",
  });
  if (await sampleCta.isVisible()) {
    await tabUntilFocused(page, sampleCta);
  }

  const search = page.getByRole("searchbox", {
    name: "Search by run name or ID",
  });
  const status = page.getByRole("combobox", { name: "Status" });
  const agent = page.getByRole("textbox", { name: "Agent" });
  const submit = page.getByRole("button", { name: "Apply filters" });
  const open = page.getByRole("link", { name: "Open run" }).first();

  await tabUntilFocused(page, search);
  await tabUntilFocused(page, status);
  await tabUntilFocused(page, agent);
  await tabUntilFocused(page, submit);
  await tabUntilFocused(page, open);
});

test("keeps visible keyboard focus and restores the exact drawer trigger", async ({
  page,
}) => {
  await page.goto(`/traces/${sampleTraceId}`);
  const origin = page.locator(
    `[data-span-id="${sampleLlmSpanId}"][data-evidence-origin="steps"]`,
  );
  await page.locator("body").click({ position: { x: 2, y: 2 } });
  await tabUntilFocused(page, origin);
  const outline = await origin.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      style: style.outlineStyle,
      width: Number.parseFloat(style.outlineWidth),
    };
  });
  expect(outline.style).not.toBe("none");
  expect(outline.width).toBeGreaterThanOrEqual(2);

  await page.keyboard.press("Enter");
  const close = page.getByRole("button", { name: "Close recorded data" });
  await expect(close).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByText("Advanced metadata")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(close).toBeFocused();

  await expectNamedControls(page);
  await expectNoAxeViolations(page);

  await page.keyboard.press("Escape");
  await expect(origin).toBeFocused();
});

test("honors reduced motion for nonessential effects", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/traces/${sampleTraceId}`);

  const offenders = await page
    .locator(".dashboard-frame, .dashboard-frame *")
    .evaluateAll((elements) =>
      elements
        .map((element) => ({
          tag: element.tagName,
          animationDuration: getComputedStyle(element).animationDuration,
          transitionDuration: getComputedStyle(element).transitionDuration,
        }))
        .filter(({ animationDuration, transitionDuration }) =>
          [animationDuration, transitionDuration].some((duration) =>
            duration
              .split(",")
              .some(
                (part) => part.endsWith("s") && Number.parseFloat(part) > 0.001,
              ),
          ),
        ),
    );
  expect(offenders).toEqual([]);
});

test("keeps textual status when color is unavailable", async ({ page }) => {
  await page.goto(`/traces/${sampleTraceId}`);
  const status = page.locator(".trace-status-fact");
  await expect(status).toContainText("Succeeded");
  await page.addStyleTag({
    content:
      "* { color: CanvasText !important; background: Canvas !important; }",
  });
  await expect(status).toContainText("Succeeded");
});
