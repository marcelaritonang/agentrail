import { createHmac, timingSafeEqual } from "node:crypto";

const API_KEY_PREFIX_LENGTH = 16;

export function apiKeyPrefix(rawKey: string): string {
  return rawKey.slice(0, API_KEY_PREFIX_LENGTH);
}

export function digestApiKey(rawKey: string, pepper: string): string {
  return createHmac("sha256", pepper).update(rawKey).digest("hex");
}

export function verifyApiKey(
  rawKey: string,
  pepper: string,
  expectedDigest: string,
): boolean {
  const presented = Buffer.from(digestApiKey(rawKey, pepper), "hex");
  const expected = Buffer.from(expectedDigest, "hex");
  if (presented.length !== 32 || expected.length !== 32) return false;
  return timingSafeEqual(presented, expected);
}
