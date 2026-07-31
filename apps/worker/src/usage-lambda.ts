import { createControlRepository, createDatabase } from "@agentrail-sdk/db";
import {
  processUsageBatch,
  type UsageWorkerRepository,
} from "./process-usage.js";

type SqsRecord = {
  messageId: string;
  body: string;
};

export type SqsUsageEvent = {
  Records: readonly SqsRecord[];
};

export type SqsPartialBatchResponse = {
  batchItemFailures: Array<{ itemIdentifier: string }>;
};

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function createUsageLambdaHandler(dependencies: {
  repository: UsageWorkerRepository;
}) {
  return async function usageLambdaHandler(
    event: SqsUsageEvent,
  ): Promise<SqsPartialBatchResponse> {
    const batchItemFailures: SqsPartialBatchResponse["batchItemFailures"] = [];

    for (const record of event.Records) {
      try {
        await processUsageBatch(
          { repository: dependencies.repository },
          JSON.parse(record.body) as unknown,
        );
      } catch {
        batchItemFailures.push({ itemIdentifier: record.messageId });
      }
    }

    return { batchItemFailures };
  };
}

let cachedRepository: UsageWorkerRepository | null = null;

function repositoryFromEnvironment(): UsageWorkerRepository {
  if (cachedRepository === null) {
    const database = createDatabase(required("DATABASE_URL"));
    cachedRepository = createControlRepository(database.db);
  }
  return cachedRepository;
}

export async function handler(
  event: SqsUsageEvent,
): Promise<SqsPartialBatchResponse> {
  return createUsageLambdaHandler({
    repository: repositoryFromEnvironment(),
  })(event);
}
