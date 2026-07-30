import { randomUUID } from "node:crypto";
import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";

import {
  MAX_INGEST_BODY_BYTES,
  MAX_USAGE_EVENTS_BODY_BYTES,
} from "@agentrail-sdk/config";
import {
  DeviceCodeRequestSchema,
  DeviceTokenRequestSchema,
  IngestSpanBatchSchema,
  type CanonicalSpanBatch,
} from "@agentrail-sdk/contracts";
import type {
  DeviceConsumeResult,
  NewInstallationCredential,
  StoredDeviceCode,
} from "@agentrail-sdk/db";
import type { SpanQueue, UsageEventQueue } from "@agentrail-sdk/queue";
import { apiKeyPrefix, verifyApiKey } from "./api-key.js";
import {
  createDeviceCode,
  createInstallationCredential,
  DEVICE_CODE_TTL_MS,
  DEVICE_POLL_INTERVAL_SECONDS,
  digestDeviceCode,
  issueRateLimitIdentity,
} from "./device.js";
import type { InstallationAuthRepository } from "./installation-auth.js";
import { handleUsageEvents } from "./usage-events.js";

type ApiKeyRecord = {
  projectId: string;
  keyDigest: string;
};

export type ApiKeyRepository = {
  findActiveByPrefix(prefix: string): Promise<ApiKeyRecord | null>;
};

export type DeviceCodeRepository = {
  issueDeviceCode(input: StoredDeviceCode): Promise<void>;
  consumeApprovedDeviceCode(input: {
    deviceCodeDigest: string;
    now: Date;
    credential: NewInstallationCredential;
    minimumPollIntervalSeconds: number;
  }): Promise<DeviceConsumeResult>;
};

export type IngestDependencies = {
  apiKeyPepper: string;
  apiKeys: ApiKeyRepository;
  queue: SpanQueue;
  usageQueue?: UsageEventQueue;
  deviceCodes?: DeviceCodeRepository;
  installations?: InstallationAuthRepository;
  activationBaseUrl?: string;
  installationCredentialPepper?: string;
  requestId?: () => string;
  now?: () => Date;
  rateLimit?: (projectId: string) => Promise<boolean>;
  deviceIssueRateLimit?: (input: {
    clientType: "codex" | "claude";
    ipHash: string;
  }) => Promise<boolean>;
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

function requestIp(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    headers.get("cf-connecting-ip") ??
    forwardedFor ??
    headers.get("x-real-ip") ??
    "unknown"
  );
}

export function createIngestApp(dependencies: IngestDependencies) {
  const app = new Hono<IngestEnvironment>();
  const nextRequestId = dependencies.requestId ?? randomUUID;
  const now = dependencies.now ?? (() => new Date());
  const activationBaseUrl =
    dependencies.activationBaseUrl ?? "http://localhost:3000/activate";

  app.use("*", async (context, next) => {
    context.set("requestId", nextRequestId());
    await next();
  });

  app.get("/healthz", (context) =>
    context.json({ status: "ok", service: "agentrail-ingest" }),
  );

  app.post("/v1/device/code", async (context) => {
    const requestId = context.get("requestId");
    if (dependencies.deviceCodes === undefined) {
      return context.json(
        { status: "service_unavailable", request_id: requestId },
        503,
      );
    }

    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json(
        { status: "invalid_request", request_id: requestId },
        400,
      );
    }

    const parsed = DeviceCodeRequestSchema.safeParse(body);
    if (!parsed.success) {
      return context.json(
        { status: "invalid_request", request_id: requestId },
        400,
      );
    }

    const rateLimitIdentity = issueRateLimitIdentity({
      clientType: parsed.data.client_type,
      ipAddress: requestIp(context.req.raw.headers),
    });

    if (
      dependencies.deviceIssueRateLimit !== undefined &&
      !(await dependencies.deviceIssueRateLimit(rateLimitIdentity))
    ) {
      return context.json(
        {
          status: "slow_down",
          request_id: requestId,
        },
        429,
        { "Retry-After": "60" },
      );
    }

    const generated = createDeviceCode();
    const issuedAt = now();
    await dependencies.deviceCodes.issueDeviceCode({
      deviceCodeId: randomUUID(),
      deviceCodeDigest: generated.deviceCodeDigest,
      userCodeDigest: generated.userCodeDigest,
      clientType: parsed.data.client_type,
      packageVersion: parsed.data.package_version,
      createdAt: issuedAt,
      expiresAt: new Date(issuedAt.getTime() + DEVICE_CODE_TTL_MS),
    });

    return context.json({
      device_code: generated.deviceCode,
      user_code: generated.userCode,
      verification_uri: activationBaseUrl,
      verification_uri_complete: `${activationBaseUrl}?code=${encodeURIComponent(generated.userCode)}`,
      expires_in: DEVICE_CODE_TTL_MS / 1_000,
      interval: DEVICE_POLL_INTERVAL_SECONDS,
      request_id: requestId,
    });
  });

  app.post("/v1/device/token", async (context) => {
    const requestId = context.get("requestId");
    if (
      dependencies.deviceCodes === undefined ||
      dependencies.installationCredentialPepper === undefined
    ) {
      return context.json(
        { status: "service_unavailable", request_id: requestId },
        503,
      );
    }

    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      return context.json(
        { status: "invalid_request", request_id: requestId },
        400,
      );
    }

    const parsed = DeviceTokenRequestSchema.safeParse(body);
    if (!parsed.success) {
      return context.json(
        { status: "invalid_request", request_id: requestId },
        400,
      );
    }

    const result = await dependencies.deviceCodes.consumeApprovedDeviceCode({
      deviceCodeDigest: digestDeviceCode(parsed.data.device_code),
      now: now(),
      credential: createInstallationCredential(
        dependencies.installationCredentialPepper,
      ),
      minimumPollIntervalSeconds: DEVICE_POLL_INTERVAL_SECONDS,
    });

    return devicePollResponse(context, requestId, result);
  });

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

  app.post(
    "/v1/events",
    bodyLimit({
      maxSize: MAX_USAGE_EVENTS_BODY_BYTES,
      onError: (context) =>
        context.json(
          {
            error: {
              code: "body_too_large",
              message: "Request body exceeds the usage-event limit",
              request_id: context.get("requestId"),
              retryable: false,
            },
          },
          413,
        ),
    }),
    (context) =>
      handleUsageEvents(context, {
        installationCredentialPepper: dependencies.installationCredentialPepper,
        installations: dependencies.installations,
        usageQueue: dependencies.usageQueue,
        now,
      }),
  );

  return app;
}

function devicePollResponse(
  context: Context<IngestEnvironment>,
  requestId: string,
  result: DeviceConsumeResult,
) {
  switch (result.status) {
    case "authorization_pending":
      return context.json(
        {
          status: "authorization_pending",
          interval: DEVICE_POLL_INTERVAL_SECONDS,
          request_id: requestId,
        },
        202,
      );
    case "slow_down":
      return context.json(
        {
          status: "slow_down",
          interval: DEVICE_POLL_INTERVAL_SECONDS,
          request_id: requestId,
        },
        429,
        { "Retry-After": String(DEVICE_POLL_INTERVAL_SECONDS) },
      );
    case "expired_token":
      return context.json(
        { status: "expired_token", request_id: requestId },
        400,
      );
    case "access_denied":
      return context.json(
        { status: "access_denied", request_id: requestId },
        403,
      );
    case "approved":
      return context.json({
        status: "approved",
        project_id: result.projectId,
        installation_id: result.installationId,
        credential: result.credential.raw,
        request_id: requestId,
      });
  }
}
