import type { SpanEnvelope } from "@agentrail/contracts";
import type {
  DeliverySummary,
  ShutdownOptions,
  SpanSink,
} from "./trace-context.js";

export type SpanTransport = {
  send(spans: SpanEnvelope[]): Promise<void>;
};

export type BufferedDeliveryOptions = {
  transport: SpanTransport;
  batchSize?: number;
  maxBuffer?: number;
  flushIntervalMs?: number;
  onDrop?: (span: SpanEnvelope) => void;
};

export class BufferedDelivery implements SpanSink {
  private readonly buffer: SpanEnvelope[] = [];
  private readonly batchSize: number;
  private readonly maxBuffer: number;
  private readonly onDrop: (span: SpanEnvelope) => void;
  private readonly timer: NodeJS.Timeout;
  private active: Promise<void> | null = null;
  private activeCount = 0;
  private delivered = 0;
  private dropped = 0;
  private closed = false;

  constructor(private readonly options: BufferedDeliveryOptions) {
    this.batchSize = options.batchSize ?? 25;
    this.maxBuffer = options.maxBuffer ?? 1_000;
    this.onDrop = options.onDrop ?? (() => undefined);

    if (this.batchSize < 1 || this.maxBuffer < 1) {
      throw new RangeError("batchSize and maxBuffer must be positive");
    }

    this.timer = setInterval(
      () => void this.flushOne().catch(() => undefined),
      options.flushIntervalMs ?? 1_000,
    );
    this.timer.unref();
  }

  add(span: SpanEnvelope): void {
    if (
      this.closed ||
      this.buffer.length + this.activeCount >= this.maxBuffer
    ) {
      this.drop(span);
      return;
    }

    this.buffer.push(span);
    if (this.buffer.length >= this.batchSize) {
      void this.flushOne().catch(() => undefined);
    }
  }

  async shutdown(options: ShutdownOptions): Promise<DeliverySummary> {
    this.closed = true;
    clearInterval(this.timer);

    let timeout: NodeJS.Timeout | undefined;
    const timedOut = new Promise<"timeout">((resolve) => {
      timeout = setTimeout(() => resolve("timeout"), options.timeoutMs);
      timeout.unref();
    });
    const drained = this.drain().then(() => "drained" as const);
    await Promise.race([drained, timedOut]);
    if (timeout !== undefined) clearTimeout(timeout);

    return this.summary();
  }

  private async drain(): Promise<void> {
    if (this.active !== null) {
      try {
        await this.active;
      } catch {
        return;
      }
    }

    while (this.buffer.length > 0) {
      try {
        await this.flushOne();
      } catch {
        return;
      }
    }
  }

  private flushOne(): Promise<void> {
    if (this.active !== null) return this.active;
    if (this.buffer.length === 0) return Promise.resolve();

    const batch = this.buffer.splice(0, this.batchSize);
    this.activeCount = batch.length;
    const operation = this.options.transport
      .send(batch)
      .then(() => {
        this.delivered += batch.length;
      })
      .catch((error: unknown) => {
        this.buffer.unshift(...batch);
        throw error;
      })
      .finally(() => {
        this.active = null;
        this.activeCount = 0;
      });
    this.active = operation;
    return operation;
  }

  private drop(span: SpanEnvelope): void {
    this.dropped += 1;
    this.onDrop(span);
  }

  private summary(): DeliverySummary {
    return {
      delivered: this.delivered,
      dropped: this.dropped,
      pending: this.buffer.length + this.activeCount,
    };
  }
}

export class HttpDeliveryError extends Error {
  constructor(
    message: string,
    public readonly status: number | null,
    public readonly retryable: boolean,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "HttpDeliveryError";
  }
}

export type HttpSpanTransportOptions = {
  endpoint: string;
  apiKey: string;
  fetch?: typeof globalThis.fetch;
  sleep?: (milliseconds: number) => Promise<void>;
  random?: () => number;
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
};

export class HttpSpanTransport implements SpanTransport {
  private readonly fetch: typeof globalThis.fetch;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly random: () => number;
  private readonly maxAttempts: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;

  constructor(private readonly options: HttpSpanTransportOptions) {
    this.fetch = options.fetch ?? globalThis.fetch;
    this.sleep =
      options.sleep ??
      ((milliseconds) =>
        new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.random = options.random ?? Math.random;
    this.maxAttempts = options.maxAttempts ?? 4;
    this.baseDelayMs = options.baseDelayMs ?? 250;
    this.maxDelayMs = options.maxDelayMs ?? 5_000;
  }

  async send(spans: SpanEnvelope[]): Promise<void> {
    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      let response: Response;
      try {
        response = await this.fetch(this.options.endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.options.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ spans }),
        });
      } catch (cause) {
        if (attempt === this.maxAttempts) {
          throw new HttpDeliveryError(
            "AgentRail ingestion network request failed",
            null,
            true,
            { cause },
          );
        }
        await this.sleep(this.backoff(attempt));
        continue;
      }

      if (response.status >= 200 && response.status < 300) return;

      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === this.maxAttempts) {
        throw new HttpDeliveryError(
          `AgentRail ingestion returned HTTP ${response.status}`,
          response.status,
          retryable,
        );
      }

      await this.sleep(
        retryAfterMilliseconds(response.headers.get("Retry-After")) ??
          this.backoff(attempt),
      );
    }
  }

  private backoff(attempt: number): number {
    const capped = Math.min(
      this.maxDelayMs,
      this.baseDelayMs * 2 ** (attempt - 1),
    );
    return Math.round(capped * (0.5 + this.random() * 0.5));
  }
}

function retryAfterMilliseconds(value: string | null): number | null {
  if (value === null) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;

  const date = Date.parse(value);
  if (Number.isNaN(date)) return null;
  return Math.max(0, date - Date.now());
}
