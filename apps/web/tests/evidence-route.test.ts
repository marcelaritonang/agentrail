import { describe, expect, it, vi } from "vitest";

import type { BlobStore } from "@agentrail-sdk/blob";
import {
  createEvidenceHandler,
  type EvidenceRepository,
} from "../lib/evidence";

const PROJECT_A = "00000000-0000-4000-8000-00000000000a";
const TRACE_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const SPAN_B = "bbbbbbbbbbbbbbbb";

function context(traceId = TRACE_B, spanId = SPAN_B) {
  return { params: Promise.resolve({ traceId, spanId }) };
}

function repository(
  span: Awaited<ReturnType<EvidenceRepository["getSpanForTrace"]>> = null,
  payloadMode: "none" | "redacted" | "full" = "redacted",
): EvidenceRepository {
  return {
    getSpanForTrace: vi.fn().mockResolvedValue(span),
    getProject: vi
      .fn()
      .mockResolvedValue({ projectId: PROJECT_A, payloadMode }),
  };
}

function blob(
  content: unknown = { prompt: "[REDACTED]", answer: "safe" },
): BlobStore {
  return {
    put: vi.fn(),
    get: vi
      .fn()
      .mockResolvedValue(new TextEncoder().encode(JSON.stringify(content))),
  };
}

describe("evidence route", () => {
  it("returns 404 for a span outside the configured project scope", async () => {
    const storage = blob();
    const scopedRepository = repository(null);
    const handler = createEvidenceHandler({
      configuredProjectId: PROJECT_A,
      repository: scopedRepository,
      blob: storage,
    });

    const response = await handler(
      new Request("http://agentrail.test/evidence"),
      context(),
    );

    expect(response.status).toBe(404);
    expect(scopedRepository.getSpanForTrace).toHaveBeenCalledWith(
      PROJECT_A,
      TRACE_B,
      SPAN_B,
    );
    expect(storage.get).not.toHaveBeenCalled();
  });

  it("returns parsed evidence without exposing its object-store location", async () => {
    const scopedRepository = repository({
      payloadRef: `s3://private-bucket/minio/${SPAN_B}.json`,
      payloadTruncated: false,
    });
    const handler = createEvidenceHandler({
      configuredProjectId: PROJECT_A,
      repository: scopedRepository,
      blob: blob(),
    });

    const response = await handler(
      new Request("http://agentrail.test/evidence"),
      context(),
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(body).not.toContain("s3://");
    expect(body).not.toContain("minio");
    expect(JSON.parse(body)).toEqual({
      state: "redacted",
      truncated: false,
      payload: { prompt: "[REDACTED]", answer: "safe" },
    });
  });

  it("returns 204 when payload capture is intentionally absent", async () => {
    const storage = blob();
    const handler = createEvidenceHandler({
      configuredProjectId: PROJECT_A,
      repository: repository(
        { payloadRef: null, payloadTruncated: false },
        "none",
      ),
      blob: storage,
    });

    const response = await handler(
      new Request("http://agentrail.test/evidence"),
      context(),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(storage.get).not.toHaveBeenCalled();
  });

  it("returns a safe 502 code when storage fails", async () => {
    const storage = blob();
    vi.mocked(storage.get).mockRejectedValue(
      new Error("minio secret endpoint"),
    );
    const handler = createEvidenceHandler({
      configuredProjectId: PROJECT_A,
      repository: repository({
        payloadRef: `payload/${PROJECT_A}/${TRACE_B}/${SPAN_B}.json`,
        payloadTruncated: true,
      }),
      blob: storage,
    });

    const response = await handler(
      new Request("http://agentrail.test/evidence"),
      context(),
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      code: "EVIDENCE_STORAGE_UNAVAILABLE",
    });
  });
});
