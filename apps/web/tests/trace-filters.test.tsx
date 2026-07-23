// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { TraceFilters } from "../components/trace-filters";

afterEach(cleanup);

describe("TraceFilters", () => {
  it("uses persistent, purpose-specific labels and native GET semantics", () => {
    render(
      <TraceFilters query="research" outcome="ok" actor="research-agent" />,
    );

    const search = screen.getByRole("search");
    expect(search).toHaveAttribute("action", "/traces");
    expect(search).toHaveAttribute("method", "get");
    expect(
      screen.getByRole("searchbox", { name: "Search by run name or ID" }),
    ).toHaveValue("research");
    expect(screen.getByRole("combobox", { name: "Status" })).toHaveValue("ok");
    expect(screen.getByRole("textbox", { name: "Agent" })).toHaveValue(
      "research-agent",
    );
    expect(screen.getByText("Agent name or ID")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Apply filters" }),
    ).toHaveAttribute("type", "submit");
  });
});
