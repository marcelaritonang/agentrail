import { describe, expect, it } from "vitest";

import { createSqsUsageEventQueue } from "./usage-sqs.js";
import type { CanonicalUsageEventBatch } from "./usage-types.js";

type CommandRecord = {
  constructor: { name: string };
  input: Record<string, unknown>;
};

class FakeSqsClient {
  readonly sent: CommandRecord[] = [];
  nextMessageBody: string | undefined;

  async send(command: CommandRecord) {
    this.sent.push(command);
    switch (command.constructor.name) {
      case "SendMessageCommand":
        return { MessageId: "sqs-usage-1" };
      case "ReceiveMessageCommand":
        if (this.nextMessageBody === undefined) {
          return { Messages: [] };
        }
        return {
          Messages: [
            {
              MessageId: "sqs-usage-1",
              ReceiptHandle: "receipt-1",
              Body: this.nextMessageBody,
              Attributes: { ApproximateReceiveCount: "3" },
            },
          ],
        };
      case "DeleteMessageCommand":
      case "ChangeMessageVisibilityCommand":
        return {};
      default:
        throw new Error(`Unexpected command ${command.constructor.name}`);
    }
  }
}

function usageBatch(): CanonicalUsageEventBatch {
  return {
    events: [
      {
        schema_version: 1,
        event_id: "ev_0123456789abcdefghijklmn",
        pack_id: "cp_0123456789abcdefghijklmn",
        event_type: "context_pack_created",
        occurred_at: "2026-07-29T10:00:00.000Z",
        project_id: "00000000-0000-4000-8000-000000000001",
        installation_id: "inst_00000000-0000-4000-8000-000000000001",
        received_at: "2026-07-29T10:00:01.000Z",
        safe_attributes: {
          client: "codex",
          package_version: "0.1.2",
          status: "ready",
          latency_ms: 1200,
          candidate_tokens_estimate: 2000,
          returned_tokens_estimate: 1200,
          source_counts: { file: 2 },
          warning_codes: [],
        },
      },
    ],
  };
}

describe("createSqsUsageEventQueue", () => {
  it("sends and reads canonical usage event batches", async () => {
    const client = new FakeSqsClient();
    const queue = createSqsUsageEventQueue({
      client,
      queueUrl: "https://sqs.example/usage",
    });

    await expect(queue.enqueue(usageBatch())).resolves.toEqual({
      messageId: "sqs-usage-1",
    });
    client.nextMessageBody = JSON.stringify(usageBatch());

    await expect(queue.read()).resolves.toMatchObject({
      messageId: "sqs-usage-1",
      receipt: "receipt-1",
      attempts: 3,
      body: usageBatch(),
    });
    expect(client.sent.map((command) => command.constructor.name)).toEqual([
      "SendMessageCommand",
      "ReceiveMessageCommand",
    ]);
  });

  it("rejects span-shaped message bodies so span and usage queues cannot be mixed", async () => {
    const client = new FakeSqsClient();
    client.nextMessageBody = JSON.stringify({ spans: [] });
    const queue = createSqsUsageEventQueue({
      client,
      queueUrl: "https://sqs.example/usage",
    });

    await expect(queue.read()).rejects.toThrow(/usage event batch/i);
  });
});
