// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TraceEmptyState } from "../components/trace-empty-state";

afterEach(cleanup);

describe("TraceEmptyState", () => {
  it("explains how unfiltered agent runs become available", () => {
    render(<TraceEmptyState filtered={false} sourceUrl={null} />);

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "No agent runs recorded yet",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Runs appear here after an instrumented application sends spans and the worker persists them.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("docker compose up -d --build"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("links to the configured source quickstart only when available", () => {
    render(
      <TraceEmptyState
        filtered={false}
        sourceUrl="https://github.com/example/agentrail"
      />,
    );

    expect(
      screen.getByRole("link", { name: "Open local quickstart" }),
    ).toHaveAttribute(
      "href",
      "https://github.com/example/agentrail#local-quickstart",
    );
  });

  it("offers a real clear-filter route for filtered results", () => {
    render(<TraceEmptyState filtered sourceUrl={null} />);

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "No agent runs match these filters",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute(
      "href",
      "/traces",
    );
    expect(
      screen.queryByText("docker compose up -d --build"),
    ).not.toBeInTheDocument();
  });
});
