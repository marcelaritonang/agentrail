// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { ComponentType } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("AgentRail landing page", () => {
  async function renderLandingPage() {
    const pagePath = resolve("apps/web/app/page.tsx");
    expect(existsSync(pagePath)).toBe(true);
    vi.resetModules();

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
      screen.getByRole("link", { name: "Explore the guided demo" }),
    ).toHaveAttribute("href", "/traces");
    expect(screen.getByText("Investigate")).toBeInTheDocument();
    expect(screen.queryByText("Replay")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/AWS startup application/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/pnpm add @agentrail-sdk\/sdk/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", {
        level: 2,
        name: "NPM publish-ready (auth required)",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Source-checkout quickstart"),
    ).not.toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Install AgentRail with npm",
      }),
    ).toBeInTheDocument();
    const installBlock = screen.getByLabelText(
      "Highlighted npm install commands",
    );
    expect(screen.getByText("SDK package")).toBeInTheDocument();
    expect(screen.getAllByText("Context CLI").length).toBeGreaterThan(0);
    expect(screen.getByText("MCP trace reader")).toBeInTheDocument();
    expect(installBlock).toHaveTextContent("Live npm commands");
    expect(installBlock).toHaveTextContent("npm install @agentrail-sdk/sdk");
    expect(installBlock).toHaveTextContent("npm install -D @agentrail-sdk/cli");
    expect(installBlock).toHaveTextContent("npx -y @agentrail-sdk/cli context");
    expect(installBlock).toHaveTextContent("npx -y @agentrail-sdk/mcp");
    expect(installBlock).not.toHaveTextContent("pnpm install");
    expect(screen.getByText("Available today")).toBeInTheDocument();
    expect(
      screen.getByText("SDK, Context CLI, MCP reader"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Publish blocker")).not.toBeInTheDocument();
    expect(screen.getByText(/Published packages/i)).toBeInTheDocument();
    expect(
      screen.getByText(/@agentrail-sdk\/mcp@0\.1\.3/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/@agentrail-sdk\/context@0\.1\.2/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/@agentrail-sdk\/cli@0\.1\.2/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Do not treat the commands as live/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/npm auth and @agentrail-sdk scope/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByText(/MCP Context profile 0\.1\.3/i).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText(/source-ready/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/waits for npm registry publish/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/needs registry publish/i),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText(/published on npm/i).length).toBeGreaterThan(0);

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Built for AWS-native deployment",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/API Gateway, Lambda, SQS/i)).toBeInTheDocument();
    expect(
      screen.getByText(/RDS\/PostgreSQL, S3, CloudWatch/i),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Amazon Bedrock cost/i).length).toBeGreaterThan(
      0,
    );

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Founding tester program",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/three developer teams/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "About and contact" }),
    ).toHaveAttribute("href", "/about");

    const screenshot = screen.getByRole("img", {
      name: /real Trace Rail screenshot/i,
    });
    expect(screenshot).toHaveAttribute(
      "src",
      expect.stringContaining("agentrail-trace-rail"),
    );
  }, 60_000);

  it("keeps landing copy restrained and free from AI-slop punctuation", async () => {
    const { container } = await renderLandingPage();
    const visibleText = container.textContent ?? "";

    expect(visibleText).not.toMatch(/[\u2013\u2014]/);
    expect(visibleText).not.toMatch(/elevate|seamless|next-gen|unleash/i);
    expect(visibleText).not.toMatch(/robot|emoji/i);
    expect(screen.queryAllByRole("article")).toHaveLength(0);
  });

  it("omits source controls when no public source URL is configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_AGENTRAIL_SOURCE_URL", "");

    await renderLandingPage();

    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute(
      "href",
      "/about",
    );
    expect(screen.queryAllByRole("link", { name: /source/i })).toHaveLength(0);
  });

  it("uses the configured source URL exactly when source controls are enabled", async () => {
    vi.stubEnv(
      "NEXT_PUBLIC_AGENTRAIL_SOURCE_URL",
      "https://git.example.dev/team/agentrail",
    );

    await renderLandingPage();

    const sourceLinks = screen.getAllByRole("link", { name: /source/i });
    expect(sourceLinks.length).toBeGreaterThan(0);
    for (const link of sourceLinks) {
      expect(link).toHaveAttribute(
        "href",
        "https://git.example.dev/team/agentrail",
      );
    }
  });
});
