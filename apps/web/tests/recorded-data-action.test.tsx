// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { RecordedDataAction } from "../components/recorded-data-action";

afterEach(cleanup);

describe("RecordedDataAction", () => {
  it("renders non-payload spans as non-interactive metadata", () => {
    render(
      <RecordedDataAction
        traceId="trace-a"
        spanId="span-a"
        hasPayload={false}
        origin="steps"
      />,
    );

    expect(screen.getByText("Metadata only")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("links payload spans to their backend-recorded data selection", () => {
    render(
      <RecordedDataAction
        traceId="trace/a"
        spanId="span?a"
        hasPayload
        origin="timeline"
      />,
    );

    expect(
      screen.getByRole("link", { name: "Inspect recorded data" }),
    ).toHaveAttribute("href", "/traces/trace%2Fa?span=span%3Fa");
    expect(screen.getByRole("link")).toHaveAttribute(
      "data-evidence-origin",
      "timeline",
    );
    expect(screen.getByRole("link")).toHaveAttribute("data-span-id", "span?a");
  });
});
