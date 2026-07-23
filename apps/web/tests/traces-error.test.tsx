// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import TracesError from "../app/(dashboard)/traces/error";

afterEach(cleanup);

describe("TracesError", () => {
  it("offers a safe retry without disclosing the thrown error", () => {
    const reset = vi.fn();
    const secret =
      "postgres://operator:password@database.internal/agentrail failed";

    render(<TracesError error={new Error(secret)} reset={reset} />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "We couldn't load agent runs",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Try the request again. Your recorded data has not been changed.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Technical details")).toBeInTheDocument();
    expect(
      screen.getByText("The project-scoped read request failed."),
    ).toBeInTheDocument();
    expect(screen.queryByText(secret)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledOnce();
  });
});
