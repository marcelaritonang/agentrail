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

async function expectNextTabFocus(page: Page, target: Locator, label: string) {
  await page.keyboard.press("Tab");
  await expect(target, `Tab should move focus to ${label}`).toBeFocused();
}

async function expectNamedControls(page: Page) {
  const controls = page.locator(
    "a[href]:visible, button:visible, input:visible, select:visible, summary:visible",
  );
  for (let index = 0; index < (await controls.count()); index += 1) {
    await expect(controls.nth(index)).toHaveAccessibleName(/\S/);
  }
}

async function focusedControlName(page: Page) {
  return page.locator(":focus").evaluate((element) => {
    function normalize(value: string | null | undefined) {
      return (value ?? "").replace(/\s+/g, " ").trim();
    }

    const ariaLabel = normalize(element.getAttribute("aria-label"));
    if (ariaLabel) return ariaLabel;

    const labelledBy = normalize(element.getAttribute("aria-labelledby"));
    if (labelledBy) {
      const label = labelledBy
        .split(" ")
        .map((id) => normalize(document.getElementById(id)?.textContent))
        .filter(Boolean)
        .join(" ");
      if (label) return label;
    }

    const label = element.closest("label");
    if (label) {
      const explicit = normalize(
        label.querySelector("span")?.textContent ?? label.textContent,
      );
      if (explicit) return explicit;
    }

    return normalize(element.textContent);
  });
}

async function tabSequence(page: Page, steps: number) {
  const names: string[] = [];
  for (let index = 0; index < steps; index += 1) {
    await page.keyboard.press("Tab");
    names.push(await focusedControlName(page));
  }
  return names;
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

test("has logical headings, named controls, and zero Axe violations on hosted login", async ({
  page,
}) => {
  await page.goto("/login");

  await expectNamedControls(page);
  expect(await page.locator("main h1").count()).toBe(1);
  await expect(
    page.getByRole("button", { name: "Continue with GitHub" }),
  ).toBeVisible();
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

test("supports logical keyboard order on the run archive", async ({
  page,
}, testInfo) => {
  await page.goto("/traces");
  await page.locator("body").click({ position: { x: 2, y: 2 } });

  if (testInfo.project.name === "mobile") {
    expect(await tabSequence(page, 10)).toEqual([
      "AgentRail home",
      "Agent runs",
      "Explore the sample run",
      "Search and filters",
      "Search by run name or ID",
      "Status",
      "Agent",
      "Apply filters",
      "Research answer",
      "Open run",
    ]);
    return;
  }

  expect(await tabSequence(page, 9)).toEqual([
    "AgentRail home",
    "Agent runs",
    "Explore the sample run",
    "Search by run name or ID",
    "Status",
    "Agent",
    "Apply filters",
    "Research answer",
    "Open run",
  ]);
});

test("keeps visible keyboard focus and restores the exact drawer trigger", async ({
  page,
}) => {
  await page.goto(`/traces/${sampleTraceId}`);
  const origin = page.locator(
    `[data-span-id="${sampleLlmSpanId}"][data-evidence-origin="steps"]`,
  );
  await page.getByRole("link", { name: "Back to all agent runs" }).focus();
  await expectNextTabFocus(page, origin, "recorded data action");
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
