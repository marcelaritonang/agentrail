import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";

import { MAX_INGEST_BODY_BYTES } from "@agentrail-sdk/config";
import {
  IngestSpanBatchSchema,
  type CanonicalSpanBatch,
} from "@agentrail-sdk/contracts";
import type { SpanQueue } from "@agentrail-sdk/queue";
import { apiKeyPrefix, verifyApiKey } from "./api-key.js";

type ApiKeyRecord = {
  projectId: string;
  keyDigest: string;
};

export type ApiKeyRepository = {
  findActiveByPrefix(prefix: string): Promise<ApiKeyRecord | null>;
};

export type IngestDependencies = {
  apiKeyPepper: string;
  apiKeys: ApiKeyRepository;
  queue: SpanQueue;
  requestId?: () => string;
  rateLimit?: (projectId: string) => Promise<boolean>;
};

type IngestEnvironment = {
  Variables: {
    requestId: string;
  };
};

function bearerToken(header: string | undefined): string | null {
  if (header === undefined) return null;
  const match = /^Bearer ([^\s]+)$/.exec(header);
  return match?.[1] ?? null;
}

export function createIngestApp(dependencies: IngestDependencies) {
  const app = new Hono<IngestEnvironment>();
  const nextRequestId = dependencies.requestId ?? randomUUID;

  app.use("*", async (context, next) => {
    context.set("requestId", nextRequestId());
    await next();
  });

  app.get("/healthz", (context) =>
    context.json({ status: "ok", service: "agentrail-ingest" }),
  );

  app.post(
    "/v1/spans",
    bodyLimit({
      maxSize: MAX_INGEST_BODY_BYTES,
      onError: (context) =>
        context.json(
          {
            error: {
              code: "body_too_large",
              message: "Request body exceeds the ingestion limit",
              request_id: context.get("requestId"),
              retryable: false,
            },
          },
          413,
        ),
    }),
    async (context) => {
      const requestId = context.get("requestId");
      const rawKey = bearerToken(context.req.header("Authorization"));
      if (rawKey === null) {
        return context.json(
          {
            error: {
              code: "unauthorized",
              message: "A valid bearer API key is required",
              request_id: requestId,
              retryable: false,
            },
          },
          401,
        );
      }

      let keyRecord: ApiKeyRecord | null;
      try {
        keyRecord = await dependencies.apiKeys.findActiveByPrefix(
          apiKeyPrefix(rawKey),
        );
      } catch {
        return context.json(
          {
            error: {
              code: "authentication_unavailable",
              message: "Authentication is temporarily unavailable",
              request_id: requestId,
              retryable: true,
            },
          },
          503,
        );
      }

      if (
        keyRecord === null ||
        !verifyApiKey(rawKey, dependencies.apiKeyPepper, keyRecord.keyDigest)
      ) {
        return context.json(
          {
            error: {
              code: "unauthorized",
              message: "A valid bearer API key is required",
              request_id: requestId,
              retryable: false,
            },
          },
          401,
        );
      }

      if (
        dependencies.rateLimit !== undefined &&
        !(await dependencies.rateLimit(keyRecord.projectId))
      ) {
        return context.json(
          {
            error: {
              code: "rate_limited",
              message: "Ingestion rate limit exceeded",
              request_id: requestId,
              retryable: true,
            },
          },
          429,
          { "Retry-After": "1" },
        );
      }

      let body: unknown;
      try {
        body = await context.req.json();
      } catch {
        return context.json(
          {
            error: {
              code: "invalid_json",
              message: "Request body must be valid JSON",
              request_id: requestId,
              retryable: false,
            },
          },
          400,
        );
      }

      const parsed = IngestSpanBatchSchema.safeParse(body);
      if (!parsed.success) {
        return context.json(
          {
            error: {
              code: "invalid_span_batch",
              message: "Request does not match the span envelope schema",
              request_id: requestId,
              retryable: false,
            },
          },
          400,
        );
      }

      const canonical: CanonicalSpanBatch = {
        spans: parsed.data.spans.map((span) => ({
          ...span,
          project_id: keyRecord.projectId,
        })),
      };

      try {
        await dependencies.queue.enqueue(canonical);
      } catch {
        return context.json(
          {
            error: {
              code: "queue_unavailable",
              message: "Ingestion queue is temporarily unavailable",
              request_id: requestId,
              retryable: true,
            },
          },
          503,
        );
      }

      return context.json(
        { accepted: canonical.spans.length, request_id: requestId },
        202,
      );
    },
  );

  return app;
}
