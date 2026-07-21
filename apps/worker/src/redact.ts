export type RedactedPayload = {
  value: unknown;
  truncated: boolean;
};

export type RedactionOptions = {
  maxBytes: number;
  redactSecrets?: boolean;
};

const SECRET_KEY =
  /^(authorization|proxyauthorization|cookie|setcookie|password|passwd|secret|clientsecret|token|accesstoken|refreshtoken|apikey|accesskey|privatekey)$/;

function normalizedKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isSecretKey(key: string): boolean {
  const normalized = normalizedKey(key);
  return (
    SECRET_KEY.test(normalized) ||
    normalized.endsWith("apikey") ||
    normalized.endsWith("accesstoken") ||
    normalized.endsWith("refreshtoken")
  );
}

function clone(value: unknown, redactSecrets: boolean): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => clone(entry, redactSecrets));
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        redactSecrets && isSecretKey(key)
          ? "[REDACTED]"
          : clone(entry, redactSecrets),
      ]),
    );
  }
  return value;
}

function serializedBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value) ?? "null");
}

function truncatedPreview(serialized: string, maxBytes: number): string {
  const marker = "[TRUNCATED] ";
  let low = 0;
  let high = serialized.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    const candidate = `${marker}${serialized.slice(0, middle)}`;
    if (serializedBytes(candidate) <= maxBytes) low = middle;
    else high = middle - 1;
  }
  const result = `${marker}${serialized.slice(0, low)}`;
  return serializedBytes(result) <= maxBytes ? result : "";
}

export function redactPayload(
  source: unknown,
  options: RedactionOptions,
): RedactedPayload {
  if (options.maxBytes < 2) {
    throw new RangeError("maxBytes must fit a JSON value");
  }

  const value = clone(source, options.redactSecrets ?? true);
  const serialized = JSON.stringify(value) ?? "null";
  if (Buffer.byteLength(serialized) <= options.maxBytes) {
    return { value, truncated: false };
  }

  return {
    value: truncatedPreview(serialized, options.maxBytes),
    truncated: true,
  };
}
