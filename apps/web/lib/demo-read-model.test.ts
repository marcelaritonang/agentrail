import { describe, expect, it } from "vitest";

import { createEvidenceHandler } from "./evidence";
import {
  createDemoBlobStore,
  createDemoEvidenceRepository,
  createDemoTraceReadRepository,
} from "./demo-read-model";
import {
  DEMO_LLM_SPAN_ID,
  DEMO_PROJECT_ID,
  DEMO_ROOT_SPAN_ID,
  DEMO_TRACE_ID,
} from "./demo-mode";
import { createTraceReadModel } from "./trace-read-model";

describe("demo read model", () => {
  it("serves a complete public trace fixture without database access", async () => {
    const model = createTraceReadModel(createDemoTraceReadRepository());

    const page = await model.listTraces({
      projectId: DEMO_PROJECT_ID,
      page: 1,
      pageSize: 25,
    });
    const detail = await model.getTraceDetail(DEMO_PROJECT_ID, DEMO_TRACE_ID);

    expect(page).toMatchObject({
      total: 1,
      items: [
        expect.objectContaining({
          traceId: DEMO_TRACE_ID,
          name: "sample.research-answer",
          outcome: "ok",
          pricingUnknown: false,
          spanCount: 4,
        }),
      ],
    });
    expect(page.items[0]).toMatchObject({
      traceId: DEMO_TRACE_ID,
      rootSpanId: DEMO_ROOT_SPAN_ID,
      spanCount: 4,
    });
    expect(detail?.spans).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          spanId: DEMO_LLM_SPAN_ID,
          kind: "llm",
          hasPayload: true,
          pricingUnknown: false,
        }),
      ]),
    );
  });

  it("matches an actor filter only against the agent ID", async () => {
    const model = createTraceReadModel(createDemoTraceReadRepository());

    await expect(
      model.listTraces({
        projectId: DEMO_PROJECT_ID,
        page: 1,
        pageSize: 25,
        actor: "research-agent",
      }),
    ).resolves.toMatchObject({ total: 1 });
    await expect(
      model.listTraces({
        projectId: DEMO_PROJECT_ID,
        page: 1,
        pageSize: 25,
        actor: "founder-review",
      }),
    ).resolves.toMatchObject({ total: 0, items: [] });
  });

  it("serves redacted evidence through the backend only", async () => {
    const handler = createEvidenceHandler({
      configuredProjectId: DEMO_PROJECT_ID,
      repository: createDemoEvidenceRepository(),
      blob: createDemoBlobStore(),
    });

    const response = await handler(new Request("https://agentrail.test"), {
      params: Promise.resolve({
        traceId: DEMO_TRACE_ID,
        spanId: DEMO_LLM_SPAN_ID,
      }),
    });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).not.toContain("demo://payload");
    expect(JSON.parse(body)).toMatchObject({
      state: "redacted",
      truncated: false,
      payload: {
        prompt: "[REDACTED]",
      },
    });
  });
});
