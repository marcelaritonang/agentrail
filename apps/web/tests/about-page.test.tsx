// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import type { ComponentType } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/source-url", () => ({
  configuredSourceUrl: () => "https://github.com/marcelaritonang/agentrail",
}));

afterEach(() => {
  cleanup();
  vi.resetModules();
});

describe("AgentRail about page", () => {
  async function renderAboutPage() {
    const pageModule = "../app/about/page";
    const { default: AboutPage } = (await import(pageModule)) as {
      default: ComponentType;
    };

    return render(<AboutPage />);
  }

  it("presents startup identity, contact, roadmap, and pitch without grant claims", async () => {
    await renderAboutPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "About AgentRail" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/AgentRail is an open-source flight recorder/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Founder")).toBeInTheDocument();
    expect(screen.getByText("Indonesia")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "GitHub Issues" })).toHaveAttribute(
      "href",
      "https://github.com/marcelaritonang/agentrail/issues",
    );
    expect(screen.getByText("30 days")).toBeInTheDocument();
    expect(screen.getByText("60 days")).toBeInTheDocument();
    expect(screen.getByText("90 days")).toBeInTheDocument();
    expect(screen.getByText(/API Gateway, Lambda, SQS/i)).toBeInTheDocument();
    expect(screen.queryByText(/funding guarantee/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/AWS startup application/i),
    ).not.toBeInTheDocument();
  });
});
