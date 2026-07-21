import {
  DeleteMessageCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
} from "@aws-sdk/client-sqs";
import { describe, expect, it } from "vitest";

import type { CanonicalSpanBatch } from "@agentrail/contracts";
import { createSqsSpanQueue } from "./sqs.js";

const batch: CanonicalSpanBatch = { spans: [] };

class FakeSqsClient {
  readonly commands: object[] = [];

  async send(command: object): Promise<unknown> {
    this.commands.push(command);

    if (command instanceof SendMessageCommand) {
      return { MessageId: "sqs-message-1" };
    }
    if (command instanceof ReceiveMessageCommand) {
      return {
        Messages: [
          {
            MessageId: "sqs-message-1",
            ReceiptHandle: "receipt-1",
            Body: JSON.stringify(batch),
            Attributes: { ApproximateReceiveCount: "2" },
          },
        ],
      };
    }
    return {};
  }
}

describe("SqsSpanQueue", () => {
  it("enqueues, reads, and acknowledges a canonical batch", async () => {
    const client = new FakeSqsClient();
    const queue = createSqsSpanQueue({
      client,
      queueUrl: "https://sqs.us-east-1.amazonaws.com/123/agentrail",
    });

    await expect(queue.enqueue(batch)).resolves.toEqual({
      messageId: "sqs-message-1",
    });
    const message = await queue.read();
    expect(message).toMatchObject({ body: batch, attempts: 2 });
    await queue.ack(message!);

    expect(client.commands).toEqual([
      expect.any(SendMessageCommand),
      expect.any(ReceiveMessageCommand),
      expect.any(DeleteMessageCommand),
    ]);
  });
});
