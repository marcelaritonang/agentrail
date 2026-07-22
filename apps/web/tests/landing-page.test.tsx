// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { ComponentType } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(cleanup);

describe("AgentRail landing page", () => {
  async function renderLandingPage() {
    const pagePath = resolve("apps/web/app/page.tsx");
    expect(existsSync(pagePath)).toBe(true);

    const pageModule = "../app/page";
    const { default: LandingPage } = (await import(pageModule)) as {
      default: ComponentType;
    };

    return render(<LandingPage />);
  }

  it("renders the approved landing structure with a real Trace Rail screenshot", async () => {
    await renderLandingPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "AgentRail" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/The flight recorder for AI agents\./),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open trace dashboard" }),
    ).toHaveAttribute("href", "/traces");
    expect(
      screen.getAllByRole("link", { name: "View source" })[0],
    ).toHaveAttribute(
      "href",
      expect.stringMatching(/^https:\/\/github\.com\//),
    );

    const screenshot = screen.getByRole("img", {
      name: /real Trace Rail screenshot/i,
    });
    expect(screenshot).toHaveAttribute(
      "src",
      expect.stringContaining("agentrail-trace-rail"),
    );
  }, 15_000);

  it("keeps landing copy restrained and free from AI-slop punctuation", async () => {
    const { container } = await renderLandingPage();
    const visibleText = container.textContent ?? "";

    expect(visibleText).not.toMatch(/[\u2013\u2014]/);
    expect(visibleText).not.toMatch(/elevate|seamless|next-gen|unleash/i);
    expect(visibleText).not.toMatch(/robot|emoji/i);
    expect(screen.queryAllByRole("article")).toHaveLength(0);
  });
});
