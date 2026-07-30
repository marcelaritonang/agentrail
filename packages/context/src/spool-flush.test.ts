import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import type { UsageEvent } from "@agentrail-sdk/contracts";
import { describe, expect, it, vi } from "vitest";

import { createContextRelay } from "./pack.js";
import {
  createUsageFlushScheduler,
  flushUsageSpool,
  type UsageSpool,
} from "./spool-flush.js";

function usageEvent(id: string): UsageEvent {
  return {
    schema_version: 1,
    event_id: id,
    pack_id: "cp_000000000000000000000001",
    event_type: "context_pack_created",
    occurred_at: "2026-07-30T00:00:00.000Z",
    safe_attributes: {
      client: "vitest",
      package_version: "0.1.0",
      status: "ready",
      latency_ms: 12,
      candidate_tokens_estimate: 1_000,
      returned_tokens_estimate: 400,
      source_counts: { project_source: 2 },
      warning_codes: [],
    },
  };
}

class MemoryUsageSpool implements UsageSpool {
  readonly events = new Map<string, UsageEvent>();
  retryAt: string | null = null;
  staleReason: string | null = null;
  reads = 0;

  constructor(events: readonly UsageEvent[] = []) {
    for (const event of events) this.events.set(event.event_id, event);
  }

  async append(event: UsageEvent): Promise<void> {
    this.events.set(event.event_id, event);
  }

  async readBatch(limit: number): Promise<readonly UsageEvent[]> {
    this.reads += 1;
    return [...this.events.values()].slice(0, limit);
  }

  async removeAccepted(eventIds: readonly string[]): Promise<void> {
    for (const eventId of eventIds) this.events.delete(eventId);
  }

  async setRetryAfter(retryAt: string | null): Promise<void> {
    this.retryAt = retryAt;
  }

  async markActivationStale(reason: string): Promise<void> {
    this.staleReason = reason;
  }
}

describe("flushUsageSpool", () => {
  it("removes every event when the hosted API accepts the full batch", async () => {
    const spool = new MemoryUsageSpool([
      usageEvent("ev_000000000000000000000001"),
      usageEvent("ev_000000000000000000000002"),
    ]);
    const fetch = vi.fn(
      async () => new Response('{"status":"accepted"}', { status: 202 }),
    );

    await expect(
      flushUsageSpool({
        spool,
        endpoint: new URL("https://agentrail.id/v1/events"),
        credential: "ar_installation_secret",
        fetch,
        now: () => new Date("2026-07-30T00:00:00.000Z"),
      }),
    ).resolves.toEqual({ accepted: 2, retained: 0, retryAt: null });

    expect(spool.events.size).toBe(0);
    expect(fetch).toHaveBeenCalledWith(
      "https://agentrail.id/v1/events",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer ar_installation_secret",
          "content-type": "application/json",
        }),
      }),
    );
  });

  it("removes only event IDs acknowledged by a partial acceptance response", async () => {
    const spool = new MemoryUsageSpool([
      usageEvent("ev_000000000000000000000001"),
      usageEvent("ev_000000000000000000000002"),
    ]);
    const fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            status: "accepted",
            accepted_event_ids: ["ev_000000000000000000000001"],
          }),
          { status: 202 },
        ),
    );

    await expect(
      flushUsageSpool({
        spool,
        endpoint: new URL("https://agentrail.id/v1/events"),
        credential: "ar_installation_secret",
        fetch,
        now: () => new Date("2026-07-30T00:00:00.000Z"),
      }),
    ).resolves.toEqual({ accepted: 1, retained: 1, retryAt: null });

    expect([...spool.events.keys()]).toEqual(["ev_000000000000000000000002"]);
  });

  it("honors Retry-After but bounds it to at most one hour", async () => {
    const spool = new MemoryUsageSpool([
      usageEvent("ev_000000000000000000000001"),
    ]);
    const fetch = vi.fn(
      async () =>
        new Response('{"status":"rate_limited"}', {
          status: 429,
          headers: { "retry-after": "999999" },
        }),
    );

    await expect(
      flushUsageSpool({
        spool,
        endpoint: new URL("https://agentrail.id/v1/events"),
        credential: "ar_installation_secret",
        fetch,
        now: () => new Date("2026-07-30T00:00:00.000Z"),
      }),
    ).resolves.toEqual({
      accepted: 0,
      retained: 1,
      retryAt: "2026-07-30T01:00:00.000Z",
    });
    expect(spool.retryAt).toBe("2026-07-30T01:00:00.000Z");
  });

  it("marks activation stale on 401 and stops retrying", async () => {
    const spool = new MemoryUsageSpool([
      usageEvent("ev_000000000000000000000001"),
    ]);
    const fetch = vi.fn(async () => new Response("{}", { status: 401 }));

    await expect(
      flushUsageSpool({
        spool,
        endpoint: new URL("https://agentrail.id/v1/events"),
        credential: "ar_installation_secret",
        fetch,
        now: () => new Date("2026-07-30T00:00:00.000Z"),
      }),
    ).resolves.toEqual({ accepted: 0, retained: 1, retryAt: null });
    expect(spool.staleReason).toBe("unauthorized");
  });

  it("retains events after 5xx or network failures", async () => {
    const events = [usageEvent("ev_000000000000000000000001")];
    const serverSpool = new MemoryUsageSpool(events);
    const networkSpool = new MemoryUsageSpool(events);

    await expect(
      flushUsageSpool({
        spool: serverSpool,
        endpoint: new URL("https://agentrail.id/v1/events"),
        credential: "ar_installation_secret",
        fetch: vi.fn(async () => new Response("{}", { status: 503 })),
        now: () => new Date("2026-07-30T00:00:00.000Z"),
      }),
    ).resolves.toMatchObject({ accepted: 0, retained: 1 });
    await expect(
      flushUsageSpool({
        spool: networkSpool,
        endpoint: new URL("https://agentrail.id/v1/events"),
        credential: "ar_installation_secret",
        fetch: vi.fn(async () => {
          throw new TypeError("network down");
        }),
        now: () => new Date("2026-07-30T00:00:00.000Z"),
      }),
    ).resolves.toMatchObject({ accepted: 0, retained: 1 });

    expect(serverSpool.events.size).toBe(1);
    expect(networkSpool.events.size).toBe(1);
  });

  it("coalesces flush requests so one MCP process has at most one active flush", async () => {
    const spool = new MemoryUsageSpool([
      usageEvent("ev_000000000000000000000001"),
    ]);
    let resolveFetch: ((response: Response) => void) | undefined;
    const fetch = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    const scheduler = createUsageFlushScheduler({
      spool,
      endpoint: new URL("https://agentrail.id/v1/events"),
      credential: "ar_installation_secret",
      fetch,
      now: () => new Date("2026-07-30T00:00:00.000Z"),
    });

    scheduler.schedule();
    scheduler.schedule();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    resolveFetch?.(new Response('{"status":"accepted"}', { status: 202 }));
    await expect(scheduler.waitForIdle()).resolves.toBeUndefined();
    expect(spool.reads).toBe(1);
  });
});

describe("Context Relay usage spool", () => {
  it("returns a Context Pack before a pending hosted flush settles", async () => {
    const root = join(
      tmpdir(),
      `agentrail-spool-pack-${process.pid}-${Date.now()}`,
    );
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(join(root, "src", "agent.ts"), "export const value = 1;\n");
    const spool = new MemoryUsageSpool();
    let fetchStarted = false;
    const fetch = vi.fn(
      () =>
        new Promise<Response>(() => {
          fetchStarted = true;
        }),
    );

    try {
      const relay = createContextRelay({
        workspaceRoot: root,
        privacyMode: "metrics-only",
        client: "vitest",
        packageVersion: "0.1.0",
        installationId: "inst_test",
        dashboardUrl: "https://agentrail.id",
        credential: "ar_installation_secret",
        usageSpool: spool,
        fetch,
        now: () => new Date("2026-07-30T00:00:00.000Z"),
      });

      const pack = await relay.prepareContext({
        task: "Find agent value",
        tokenBudget: 1_000,
      });

      expect(pack.status).toBe("ready");
      expect(spool.events.size).toBe(1);
      await vi.waitFor(() => expect(fetchStarted).toBe(true));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
