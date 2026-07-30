import type { Context } from "hono";

import { MAX_USAGE_EVENTS_BODY_BYTES } from "@agentrail-sdk/config";
import { createUsageEventBatchSchema } from "@agentrail-sdk/contracts";
import type { UsageEventQueue } from "@agentrail-sdk/queue";
import {
  authenticateInstallationCredential,
  type InstallationAuthRepository,
} from "./installation-auth.js";

type UsageEventEnvironment = {
  Variables: {
    requestId: string;
  };
};

export type UsageEventDependencies = {
  installationCredentialPepper: string | undefined;
  installations: InstallationAuthRepository | undefined;
  usageQueue: UsageEventQueue | undefined;
  now: () => Date;
};

export async function handleUsageEvents(
  context: Context<UsageEventEnvironment>,
  dependencies: UsageEventDependencies,
) {
  const requestId = context.get("requestId");
  if (
    dependencies.installationCredentialPepper === undefined ||
    dependencies.installations === undefined ||
    dependencies.usageQueue === undefined
  ) {
    return context.json(
      {
        error: {
          code: "service_unavailable",
          message: "Hosted usage events are not configured",
          request_id: requestId,
          retryable: true,
        },
      },
      503,
    );
  }

  const auth = await authenticateInstallationCredential({
    authorization: context.req.header("Authorization"),
    pepper: dependencies.installationCredentialPepper,
    repository: dependencies.installations,
  });
  if (auth.status === "unavailable") {
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
  if (auth.status === "unauthorized") {
    return context.json(
      {
        error: {
          code: "unauthorized",
          message: "A valid bearer installation credential is required",
          request_id: requestId,
          retryable: false,
        },
      },
      401,
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

  const parsed = createUsageEventBatchSchema({
    maxBodyBytes: MAX_USAGE_EVENTS_BODY_BYTES,
    now: dependencies.now,
  }).safeParse(body);
  if (!parsed.success) {
    return context.json(
      {
        error: {
          code: "invalid_usage_event_batch",
          message: "Request does not match the usage-event schema",
          request_id: requestId,
          retryable: false,
        },
      },
      400,
    );
  }

  const receivedAt = dependencies.now().toISOString();
  const canonical = {
    events: parsed.data.events.map((event) => ({
      ...event,
      project_id: auth.projectId,
      installation_id: auth.installationId,
      received_at: receivedAt,
    })),
  };

  try {
    await dependencies.usageQueue.enqueue(canonical);
  } catch {
    return context.json(
      {
        error: {
          code: "queue_unavailable",
          message: "Usage-event queue is temporarily unavailable",
          request_id: requestId,
          retryable: true,
        },
      },
      503,
    );
  }

  return context.json(
    { accepted: canonical.events.length, request_id: requestId },
    202,
  );
}
