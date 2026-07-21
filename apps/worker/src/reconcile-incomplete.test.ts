import { describe, expect, it, vi } from "vitest";

import { TRACE_INCOMPLETE_AFTER_MS } from "@agentrail/config";
import { reconcileIncompleteTraces } from "./reconcile-incomplete.js";

describe("reconcileIncompleteTraces", () => {
  it("marks traces incomplete at the shared 15 minute boundary", async () => {
    const markIncompleteBefore = vi.fn(async () => 1);
    const now = new Date("2026-07-21T10:15:00.000Z");

    await expect(
      reconcileIncompleteTraces({
        now,
        timeoutMs: TRACE_INCOMPLETE_AFTER_MS,
        repository: { markIncompleteBefore },
      }),
    ).resolves.toBe(1);
    expect(markIncompleteBefore).toHaveBeenCalledWith(
      new Date("2026-07-21T10:00:00.000Z"),
    );
  });
});
