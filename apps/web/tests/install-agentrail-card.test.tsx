// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InstallAgentRailCard } from "../components/install-agentrail-card";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("InstallAgentRailCard", () => {
  it("copies the live npm commands with polite feedback", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(<InstallAgentRailCard sourceUrl={null} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Copy npm install @agentrail-sdk/sdk",
      }),
    );

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith("npm install @agentrail-sdk/sdk"),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Copied npm install @agentrail-sdk/sdk",
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Copy npm install -D @agentrail-sdk/cli",
      }),
    );

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        "npm install -D @agentrail-sdk/cli",
      ),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Copied npm install -D @agentrail-sdk/cli",
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: /Copy npx -y @agentrail-sdk\/cli context/,
      }),
    );

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        'npx -y @agentrail-sdk/cli context --root . --task "Audit this change" --token-budget 4000 --json',
      ),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Copy npx -y @agentrail-sdk/mcp",
      }),
    );

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith("npx -y @agentrail-sdk/mcp"),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Copy npx -y @agentrail-sdk/mcp --profile context",
      }),
    );

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        "npx -y @agentrail-sdk/mcp --profile context",
      ),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Copied npx -y @agentrail-sdk/mcp --profile context",
    );
    expect(screen.queryByText(/source-ready/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/registry shows 0\.1\.2/i),
    ).not.toBeInTheDocument();
  });
});
