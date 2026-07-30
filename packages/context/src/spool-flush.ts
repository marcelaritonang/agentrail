import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

import type { UsageEvent } from "@agentrail-sdk/contracts";

const MAX_BATCH_EVENTS = 100;
const MIN_RETRY_MS = 5_000;
const MAX_RETRY_MS = 60 * 60 * 1_000;

export type UsageSpool = {
  append(event: UsageEvent): Promise<void>;
  readBatch(limit: number): Promise<readonly UsageEvent[]>;
  removeAccepted(eventIds: readonly string[]): Promise<void>;
  setRetryAfter(retryAt: string | null): Promise<void>;
  markActivationStale(reason: string): Promise<void>;
};

export type FlushUsageSpoolInput = {
  spool: UsageSpool;
  endpoint: URL;
  credential: string;
  fetch: typeof fetch;
  signal?: AbortSignal;
  now?: () => Date;
};

export type FlushUsageSpoolResult = {
  accepted: number;
  retained: number;
  retryAt: string | null;
};

export type UsageFlushScheduler = {
  schedule(): void;
  waitForIdle(): Promise<void>;
};

export function createFileUsageSpool(root: string): UsageSpool {
  return new FileUsageSpool(resolve(root, ".agentrail", "spool"));
}

export async function readRestrictedFileCredential(input: {
  root: string;
  projectKey?: string;
}): Promise<string | null> {
  const projectKey =
    input.projectKey ?? defaultCredentialProjectKey(input.root);
  let parsed: unknown;
  try {
    parsed = JSON.parse(
      await readFile(
        resolve(input.root, ".agentrail", "credentials", "v1.json"),
        "utf8",
      ),
    );
  } catch {
    return null;
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("credentials" in parsed) ||
    typeof (parsed as { credentials?: unknown }).credentials !== "object" ||
    (parsed as { credentials?: unknown }).credentials === null
  ) {
    return null;
  }

  const credential = (parsed as { credentials: Record<string, unknown> })
    .credentials[projectKey];
  return typeof credential === "string" && credential.length > 0
    ? credential
    : null;
}

export function defaultCredentialProjectKey(root: string): string {
  return `workspace_${createHash("sha256").update(resolve(root)).digest("hex").slice(0, 32)}`;
}

export async function flushUsageSpool(
  input: FlushUsageSpoolInput,
): Promise<FlushUsageSpoolResult> {
  const now = input.now ?? (() => new Date());
  const events = await input.spool.readBatch(MAX_BATCH_EVENTS);
  if (events.length === 0) {
    return { accepted: 0, retained: 0, retryAt: null };
  }

  let response: Response;
  try {
    response = await input.fetch(input.endpoint.toString(), {
      method: "POST",
      headers: {
        authorization: `Bearer ${input.credential}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ events }),
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    });
  } catch {
    const retryAt = retryAtFromDelay(now(), MIN_RETRY_MS);
    await input.spool.setRetryAfter(retryAt);
    return { accepted: 0, retained: events.length, retryAt };
  }

  if (response.status === 202) {
    const acceptedEventIds = await acceptedIdsFromResponse(response, events);
    await input.spool.removeAccepted(acceptedEventIds);
    await input.spool.setRetryAfter(null);
    return {
      accepted: acceptedEventIds.length,
      retained: events.length - acceptedEventIds.length,
      retryAt: null,
    };
  }

  if (response.status === 401) {
    await input.spool.markActivationStale("unauthorized");
    return { accepted: 0, retained: events.length, retryAt: null };
  }

  const retryMs =
    response.status === 429
      ? boundedRetryAfterMs(response.headers.get("retry-after"))
      : MIN_RETRY_MS;
  const retryAt = retryAtFromDelay(now(), retryMs);
  await input.spool.setRetryAfter(retryAt);
  return { accepted: 0, retained: events.length, retryAt };
}

export function createUsageFlushScheduler(
  input: FlushUsageSpoolInput & {
    setTimeout?: typeof setTimeout;
    random?: () => number;
  },
): UsageFlushScheduler {
  let active: Promise<void> | null = null;
  let attempts = 0;
  const setTimer = input.setTimeout ?? setTimeout;
  const random = input.random ?? Math.random;

  function schedule(): void {
    if (active !== null || input.signal?.aborted) return;
    active = flushUsageSpool(input)
      .then((result) => {
        if (result.accepted > 0) attempts = 0;
        if (
          result.retained > 0 &&
          result.retryAt !== null &&
          !input.signal?.aborted
        ) {
          attempts += 1;
          const delay = nextBackoffDelayMs(attempts, random());
          const timer = setTimer(schedule, delay);
          if (
            typeof timer === "object" &&
            timer !== null &&
            "unref" in timer &&
            typeof timer.unref === "function"
          ) {
            timer.unref();
          }
        }
      })
      .finally(() => {
        active = null;
      });
  }

  return {
    schedule,
    async waitForIdle() {
      await active;
    },
  };
}

class FileUsageSpool implements UsageSpool {
  readonly #directory: string;
  readonly #eventsPath: string;
  readonly #retryPath: string;
  readonly #stalePath: string;

  constructor(directory: string) {
    this.#directory = directory;
    this.#eventsPath = resolve(directory, "events.v1.jsonl");
    this.#retryPath = resolve(directory, "retry.v1.json");
    this.#stalePath = resolve(directory, "activation-stale.v1.json");
  }

  async append(event: UsageEvent): Promise<void> {
    await mkdir(this.#directory, { recursive: true });
    await writeFile(this.#eventsPath, `${JSON.stringify(event)}\n`, {
      flag: "a",
    });
  }

  async readBatch(limit: number): Promise<readonly UsageEvent[]> {
    const events = await this.#readAll();
    return events.slice(0, Math.max(1, Math.min(MAX_BATCH_EVENTS, limit)));
  }

  async removeAccepted(eventIds: readonly string[]): Promise<void> {
    const accepted = new Set(eventIds);
    const retained = (await this.#readAll()).filter(
      (event) => !accepted.has(event.event_id),
    );
    if (retained.length === 0) {
      await rm(this.#eventsPath, { force: true });
      return;
    }
    await this.#replaceEvents(retained);
  }

  async setRetryAfter(retryAt: string | null): Promise<void> {
    if (retryAt === null) {
      await rm(this.#retryPath, { force: true });
      return;
    }
    await mkdir(this.#directory, { recursive: true });
    await writeFile(this.#retryPath, `${JSON.stringify({ retryAt })}\n`);
  }

  async markActivationStale(reason: string): Promise<void> {
    await mkdir(this.#directory, { recursive: true });
    await writeFile(
      this.#stalePath,
      `${JSON.stringify({ reason, recordedAt: new Date().toISOString() })}\n`,
    );
  }

  async #readAll(): Promise<UsageEvent[]> {
    let text: string;
    try {
      text = await readFile(this.#eventsPath, "utf8");
    } catch {
      return [];
    }
    return text
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .flatMap((line) => {
        try {
          return [JSON.parse(line) as UsageEvent];
        } catch {
          return [];
        }
      });
  }

  async #replaceEvents(events: readonly UsageEvent[]): Promise<void> {
    await mkdir(this.#directory, { recursive: true });
    const tempPath = `${this.#eventsPath}.tmp-${process.pid}-${Date.now()}`;
    await writeFile(
      tempPath,
      events.map((event) => JSON.stringify(event)).join("\n") + "\n",
    );
    await rename(tempPath, this.#eventsPath);
  }
}

async function acceptedIdsFromResponse(
  response: Response,
  events: readonly UsageEvent[],
): Promise<readonly string[]> {
  let parsed: unknown;
  try {
    parsed = await response.json();
  } catch {
    return events.map((event) => event.event_id);
  }
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "accepted_event_ids" in parsed &&
    Array.isArray(
      (parsed as { accepted_event_ids?: unknown }).accepted_event_ids,
    )
  ) {
    const accepted = new Set(events.map((event) => event.event_id));
    return (parsed as { accepted_event_ids: unknown[] }).accepted_event_ids
      .filter((eventId): eventId is string => typeof eventId === "string")
      .filter((eventId) => accepted.has(eventId));
  }
  return events.map((event) => event.event_id);
}

function boundedRetryAfterMs(value: string | null): number {
  if (value === null) return MIN_RETRY_MS;
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return MIN_RETRY_MS;
  return Math.max(MIN_RETRY_MS, Math.min(MAX_RETRY_MS, seconds * 1_000));
}

function retryAtFromDelay(now: Date, delayMs: number): string {
  return new Date(now.getTime() + delayMs).toISOString();
}

function nextBackoffDelayMs(attempt: number, random: number): number {
  const exponential = MIN_RETRY_MS * 2 ** Math.max(0, attempt - 1);
  const jitter = Math.floor(MIN_RETRY_MS * Math.max(0, Math.min(1, random)));
  return Math.min(MAX_RETRY_MS, exponential + jitter);
}
