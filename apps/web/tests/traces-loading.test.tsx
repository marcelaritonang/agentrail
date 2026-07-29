// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import TracesLoading from "../app/(dashboard)/traces/loading";

afterEach(cleanup);

describe("TracesLoading", () => {
  it("announces the purpose and progress of the agent-run request", () => {
    const { container } = render(<TracesLoading />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Agent runs" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Review recorded work from your instrumented AI agents.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Loading agent runs…")).toBeInTheDocument();

    const busyRegion = screen.getByRole("region", {
      name: "Loading agent runs",
    });
    expect(busyRegion).toHaveAttribute("aria-busy", "true");
    expect(container.querySelector(".loading-filters")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(container.querySelector(".loading-table")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});
