import {
  GetObjectCommand,
  PutObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";

import type { BlobStore } from "./types.js";

export function createS3BlobStore(options: {
  client: S3Client;
  bucket: string;
}): BlobStore {
  return {
    async put(input) {
      await options.client.send(
        new PutObjectCommand({
          Bucket: options.bucket,
          Key: input.ref,
          Body: input.content,
          ContentType: input.contentType,
        }),
      );
      return { ref: input.ref };
    },

    async get(ref) {
      try {
        const result = await options.client.send(
          new GetObjectCommand({ Bucket: options.bucket, Key: ref }),
        );
        if (result.Body === undefined) {
          return null;
        }
        return new Uint8Array(await result.Body.transformToByteArray());
      } catch (error) {
        if (
          error instanceof Error &&
          (error.name === "NoSuchKey" || error.name === "NotFound")
        ) {
          return null;
        }
        throw error;
      }
    },
  };
}
