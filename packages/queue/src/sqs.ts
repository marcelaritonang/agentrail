import {
  ChangeMessageVisibilityCommand,
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
} from "@aws-sdk/client-sqs";

import type { CanonicalSpanBatch } from "@agentrail/contracts";
import type { QueueMessage, SpanQueue } from "./types.js";

type SqsCommand =
  | SendMessageCommand
  | ReceiveMessageCommand
  | DeleteMessageCommand
  | ChangeMessageVisibilityCommand;

export type SqsClientLike = {
  send(command: SqsCommand): Promise<unknown>;
};

export function createSqsSpanQueue(options: {
  client: SqsClientLike;
  queueUrl: string;
}): SpanQueue {
  return {
    async enqueue(batch) {
      const result = (await options.client.send(
        new SendMessageCommand({
          QueueUrl: options.queueUrl,
          MessageBody: JSON.stringify(batch),
        }),
      )) as { MessageId?: string };

      if (result.MessageId === undefined) {
        throw new Error("SQS enqueue response is missing MessageId");
      }
      return { messageId: result.MessageId };
    },

    async read() {
      const result = (await options.client.send(
        new ReceiveMessageCommand({
          QueueUrl: options.queueUrl,
          MaxNumberOfMessages: 1,
          WaitTimeSeconds: 10,
          MessageSystemAttributeNames: ["ApproximateReceiveCount"],
        }),
      )) as {
        Messages?: Array<{
          MessageId?: string;
          ReceiptHandle?: string;
          Body?: string;
          Attributes?: Record<string, string>;
        }>;
      };
      const message = result.Messages?.[0];
      if (message === undefined) {
        return null;
      }
      if (
        message.MessageId === undefined ||
        message.ReceiptHandle === undefined ||
        message.Body === undefined
      ) {
        throw new Error("SQS message is missing required fields");
      }

      return {
        messageId: message.MessageId,
        receipt: message.ReceiptHandle,
        body: JSON.parse(message.Body) as CanonicalSpanBatch,
        attempts: Number(message.Attributes?.ApproximateReceiveCount ?? "1"),
      };
    },

    async ack(message) {
      await options.client.send(
        new DeleteMessageCommand({
          QueueUrl: options.queueUrl,
          ReceiptHandle: message.receipt,
        }),
      );
    },

    async fail(message) {
      await options.client.send(
        new ChangeMessageVisibilityCommand({
          QueueUrl: options.queueUrl,
          ReceiptHandle: message.receipt,
          VisibilityTimeout: 0,
        }),
      );
    },
  };
}
