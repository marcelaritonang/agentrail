import {
  CreateBucketCommand,
  HeadBucketCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createS3BlobStore } from "./s3.js";

const bucket = `agentrail-test-${process.pid}-${Date.now()}`;
const minioEndpoint = process.env.TEST_MINIO_ENDPOINT;
const describeS3 = minioEndpoint ? describe : describe.skip;
const client = new S3Client({
  endpoint: minioEndpoint ?? "http://localhost:9000",
  region: "us-east-1",
  forcePathStyle: true,
  credentials: {
    accessKeyId: "agentrail-local",
    secretAccessKey: "agentrail-local-secret",
  },
});
const store = createS3BlobStore({ client, bucket });

beforeAll(async () => {
  await client.send(new CreateBucketCommand({ Bucket: bucket }));
  await client.send(new HeadBucketCommand({ Bucket: bucket }));
});

afterAll(() => {
  client.destroy();
});

describeS3("S3BlobStore", () => {
  it("stores and retrieves bytes by opaque reference without returning a URL", async () => {
    const reference = "payload/project/trace/span.json";
    const content = new TextEncoder().encode('{"query":"safe"}');

    const receipt = await store.put({
      ref: reference,
      content,
      contentType: "application/json",
    });

    expect(receipt).toEqual({ ref: reference });
    expect(receipt.ref).not.toMatch(/^https?:\/\//);
    await expect(store.get(reference)).resolves.toEqual(content);
  });
});
