import { expect, test } from "@playwright/test";

import { sampleLlmSpanId, sampleTraceId } from "./sample-state";

test("keeps visible keyboard focus and contains the drawer", async ({
  page,
}) => {
  await page.goto(`/traces/${sampleTraceId}`);
  await page.keyboard.press("Tab");
  const focused = page.locator(":focus");
  await expect(focused).toBeVisible();
  const outline = await focused.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      style: style.outlineStyle,
      width: Number.parseFloat(style.outlineWidth),
    };
  });
  expect(outline.style).not.toBe("none");
  expect(outline.width).toBeGreaterThanOrEqual(2);

  const origin = page.locator(`[data-span-id="${sampleLlmSpanId}"]`);
  await origin.focus();
  await page.keyboard.press("Enter");
  const close = page.getByRole("button", { name: "Close evidence" });
  await expect(close).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(origin).toBeFocused();
});

test("honors reduced motion for nonessential effects", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/traces/${sampleTraceId}`);

  const offenders = await page.locator("body *").evaluateAll((elements) =>
    elements
      .map((element) => ({
        tag: element.tagName,
        duration: getComputedStyle(element).animationDuration,
      }))
      .filter(({ duration }) =>
        duration
          .split(",")
          .some(
            (part) => part.endsWith("s") && Number.parseFloat(part) > 0.001,
          ),
      ),
  );
  expect(offenders).toEqual([]);
});
