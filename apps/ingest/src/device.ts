import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

export const DEVICE_CODE_TTL_MS = 10 * 60 * 1_000;
export const DEVICE_POLL_INTERVAL_SECONDS = 5;

const USER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function createDeviceCode(): {
  deviceCode: string;
  deviceCodeDigest: string;
  userCode: string;
  userCodeDigest: string;
} {
  const deviceCode = randomBytes(32).toString("base64url");
  const userCode = formatUserCode(randomBytes(12));

  return {
    deviceCode,
    deviceCodeDigest: digestDeviceCode(deviceCode),
    userCode,
    userCodeDigest: digestUserCode(userCode),
  };
}

export function createInstallationCredential(pepper: string): {
  installationId: string;
  raw: string;
  prefix: string;
  digest: string;
} {
  const secret = randomBytes(32).toString("base64url");
  const raw = `ar_inst_${secret}`;

  return {
    installationId: `inst_${randomUUID()}`,
    raw,
    prefix: raw.slice(0, 20),
    digest: createHmac("sha256", pepper).update(raw).digest("hex"),
  };
}

export function digestDeviceCode(deviceCode: string): string {
  return createHash("sha256").update(deviceCode).digest("hex");
}

export function digestUserCode(userCode: string): string {
  return createHash("sha256").update(normalizeUserCode(userCode)).digest("hex");
}

export function safeDigestEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  if (leftBuffer.length !== rightBuffer.length) {
    const longest = Math.max(leftBuffer.length, rightBuffer.length);
    const padding = Buffer.alloc(longest);
    timingSafeEqual(padding, padding);
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function normalizeUserCode(userCode: string): string {
  return userCode.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

export function issueRateLimitIdentity(input: {
  clientType: "codex" | "claude";
  ipAddress: string;
}): { clientType: "codex" | "claude"; ipHash: string } {
  return {
    clientType: input.clientType,
    ipHash: createHash("sha256")
      .update(input.ipAddress)
      .digest("hex")
      .slice(0, 32),
  };
}

export function createInMemoryDeviceIssueLimiter(options: {
  maxPerWindow: number;
  windowMs: number;
  now?: () => number;
}) {
  const attempts = new Map<string, { count: number; resetAt: number }>();
  const now = options.now ?? Date.now;

  return async (input: {
    clientType: "codex" | "claude";
    ipHash: string;
  }): Promise<boolean> => {
    const key = `${input.clientType}:${input.ipHash}`;
    const current = now();
    const existing = attempts.get(key);

    if (existing === undefined || existing.resetAt <= current) {
      attempts.set(key, {
        count: 1,
        resetAt: current + options.windowMs,
      });
      return true;
    }

    if (existing.count >= options.maxPerWindow) {
      return false;
    }

    existing.count += 1;
    return true;
  };
}

function formatUserCode(bytes: Buffer): string {
  const characters = Array.from(bytes)
    .slice(0, 12)
    .map((byte) => USER_CODE_ALPHABET[byte % USER_CODE_ALPHABET.length])
    .join("");

  return `${characters.slice(0, 4)}-${characters.slice(4, 8)}-${characters.slice(8, 12)}`;
}
