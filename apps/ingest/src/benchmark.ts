import { mkdir, writeFile } from "node:fs/promises";
import { arch, cpus, platform, release } from "node:os";
import { dirname, resolve } from "node:path";
import { performance } from "node:perf_hooks";

import type { CanonicalSpanBatch } from "@agentrail-sdk/contracts";
import { createRedisStreamsQueue } from "@agentrail-sdk/queue";
import { digestApiKey } from "./api-key.js";
import { createIngestApp } from "./app.js";

const API_KEY = `ar_bench_${"a".repeat(64)}`;
const PEPPER = "agentrail-local-benchmark-pepper";
const PROJECT_ID = "00000000-0000-4000-8000-000000000001";
const WARMUPS = 100;
const REQUESTS = 1_000;
const CONCURRENCY = 10;

const body = JSON.stringify({
  spans: [
    {
      schema_version: 1,
      trace_id: "0af7651916cd43dd8448eb211c80319c",
      span_id: "b7ad6b7169203331",
      parent_span_id: null,
      trace_name: "benchmark.trace",
      kind: "llm",
      name: "benchmark.span",
      agent_id: "benchmark-agent",
      on_behalf_of: null,
      started_at: "2026-07-21T10:00:00.000Z",
      ended_at: "2026-07-21T10:00:01.000Z",
      outcome: "ok",
      attributes: { sample_data: true },
    },
  ],
});

const suffix = `${process.pid}-${Date.now()}`;
const queue = await createRedisStreamsQueue({
  url: process.env.REDIS_URL ?? "redis://localhost:6379",
  stream: `agentrail:benchmark:${suffix}`,
  group: `workers:${suffix}`,
  consumer: `worker:${suffix}`,
  blockMs: 10,
});

const app = createIngestApp({
  apiKeyPepper: PEPPER,
  apiKeys: {
    findActiveByPrefix: async () => ({
      projectId: PROJECT_ID,
      keyDigest: digestApiKey(API_KEY, PEPPER),
    }),
  },
  queue,
});

async function issueRequest(): Promise<number> {
  const started = performance.now();
  const response = await app.request("/v1/spans", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body,
  });
  if (response.status !== 202) {
    throw new Error(`Benchmark ingestion returned ${response.status}`);
  }
  return performance.now() - started;
}

async function runConcurrent(
  count: number,
  record: boolean,
): Promise<number[]> {
  const durations: number[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < count) {
        next += 1;
        const duration = await issueRequest();
        if (record) durations.push(duration);
      }
    }),
  );
  return durations;
}

function percentile(sorted: number[], ratio: number): number {
  const index = Math.max(0, Math.ceil(sorted.length * ratio) - 1);
  return Number((sorted[index] ?? 0).toFixed(3));
}

try {
  await runConcurrent(WARMUPS, false);
  const durations = (await runConcurrent(REQUESTS, true)).sort((a, b) => a - b);
  const report = {
    profile: "warm-local-redis-worker-stopped",
    recorded_at: new Date().toISOString(),
    warmups: WARMUPS,
    requests: REQUESTS,
    concurrency: CONCURRENCY,
    body_bytes: Buffer.byteLength(body),
    latency_ms: {
      p50: percentile(durations, 0.5),
      p95: percentile(durations, 0.95),
      p99: percentile(durations, 0.99),
    },
    budget_ms: { p95: 100 },
    environment: {
      node: process.version,
      platform: platform(),
      release: release(),
      arch: arch(),
      cpu: cpus()[0]?.model ?? "unknown",
      logical_cpus: cpus().length,
    },
  };

  const output = process.env.BENCHMARK_OUTPUT;
  if (output !== undefined) {
    const absolute = resolve(output);
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.latency_ms.p95 > report.budget_ms.p95) process.exitCode = 1;
} finally {
  await queue.purge();
  queue.close();
}
