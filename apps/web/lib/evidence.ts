import type { BlobStore } from "@agentrail-sdk/blob";
import type { PayloadMode } from "@agentrail-sdk/db";

export type EvidenceSpan = {
  payloadRef: string | null;
  payloadTruncated: boolean;
};

export type EvidenceRepository = {
  getSpanForTrace(
    projectId: string,
    traceId: string,
    spanId: string,
  ): Promise<EvidenceSpan | null>;
  getProject(
    projectId: string,
  ): Promise<{ projectId: string; payloadMode: PayloadMode } | null>;
};

export type EvidenceRouteContext = {
  params: Promise<{ traceId: string; spanId: string }>;
};

export type EvidenceHandlerDependencies = {
  configuredProjectId: string;
  repository: EvidenceRepository;
  blob: BlobStore;
};

const PRIVATE_HEADERS = {
  "cache-control": "private, no-store",
  "x-content-type-options": "nosniff",
};

function json(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: PRIVATE_HEADERS });
}

export function createEvidenceHandler(
  dependencies: EvidenceHandlerDependencies,
) {
  return async function evidenceHandler(
    _request: Request,
    context: EvidenceRouteContext,
  ): Promise<Response> {
    const { traceId, spanId } = await context.params;
    const span = await dependencies.repository.getSpanForTrace(
      dependencies.configuredProjectId,
      traceId,
      spanId,
    );
    if (span === null) return json({ code: "EVIDENCE_NOT_FOUND" }, 404);

    const project = await dependencies.repository.getProject(
      dependencies.configuredProjectId,
    );
    if (project === null) return json({ code: "EVIDENCE_NOT_FOUND" }, 404);
    if (project.payloadMode === "none" || span.payloadRef === null) {
      return new Response(null, { status: 204, headers: PRIVATE_HEADERS });
    }

    try {
      const content = await dependencies.blob.get(span.payloadRef);
      if (content === null)
        return json({ code: "EVIDENCE_OBJECT_MISSING" }, 502);
      const payload: unknown = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(content),
      );
      return json(
        {
          state: project.payloadMode === "redacted" ? "redacted" : "available",
          truncated: span.payloadTruncated,
          payload,
        },
        200,
      );
    } catch {
      return json({ code: "EVIDENCE_STORAGE_UNAVAILABLE" }, 502);
    }
  };
}
