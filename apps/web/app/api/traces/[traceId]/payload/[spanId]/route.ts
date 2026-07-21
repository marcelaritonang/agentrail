import { S3Client } from "@aws-sdk/client-s3";

import { createS3BlobStore } from "@agentrail/blob";
import { createDatabase, createSpanRepository } from "@agentrail/db";
import { createEvidenceHandler } from "../../../../../../lib/evidence";

export const dynamic = "force-dynamic";

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

let productionHandler: ReturnType<typeof createEvidenceHandler> | undefined;

function handler(): ReturnType<typeof createEvidenceHandler> {
  if (productionHandler !== undefined) return productionHandler;

  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const database = createDatabase(required("DATABASE_URL"));
  const client = new S3Client({
    region: process.env.S3_REGION ?? "us-east-1",
    ...(endpoint === undefined ? {} : { endpoint, forcePathStyle: true }),
    ...(accessKeyId === undefined || secretAccessKey === undefined
      ? {}
      : { credentials: { accessKeyId, secretAccessKey } }),
  });

  productionHandler = createEvidenceHandler({
    configuredProjectId: required("AGENTRAIL_PROJECT_ID"),
    repository: createSpanRepository(database.db),
    blob: createS3BlobStore({ client, bucket: required("S3_BUCKET") }),
  });
  return productionHandler;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ traceId: string; spanId: string }> },
): Promise<Response> {
  return handler()(request, context);
}
