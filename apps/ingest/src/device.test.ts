import { describe, expect, it } from "vitest";

import {
  createDeviceCode,
  createInstallationCredential,
  digestDeviceCode,
  digestUserCode,
  safeDigestEqual,
} from "./device.js";

describe("device activation crypto", () => {
  it("creates high-entropy device codes and stores only digests", () => {
    const generated = createDeviceCode();

    expect(generated.deviceCode).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generated.deviceCode.length * 6).toBeGreaterThanOrEqual(144);
    expect(generated.deviceCodeDigest).toBe(
      digestDeviceCode(generated.deviceCode),
    );
    expect(generated.deviceCodeDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(generated.deviceCodeDigest).not.toContain(generated.deviceCode);
  });

  it("creates human-readable user codes but stores only normalized digests", () => {
    const generated = createDeviceCode();

    expect(generated.userCode).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(generated.userCodeDigest).toBe(digestUserCode(generated.userCode));
    expect(generated.userCodeDigest).toBe(
      digestUserCode(generated.userCode.toLowerCase().replaceAll("-", " ")),
    );
    expect(generated.userCodeDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(generated.userCodeDigest).not.toContain(generated.userCode);
  });

  it("creates high-entropy installation credentials with a searchable prefix", () => {
    const credential = createInstallationCredential("pepper-32-bytes-or-more");

    expect(credential.raw).toMatch(/^ar_inst_[A-Za-z0-9_-]{43}$/);
    expect(credential.raw.length * 6).toBeGreaterThanOrEqual(144);
    expect(credential.prefix).toMatch(/^ar_inst_[A-Za-z0-9_-]{8,}$/);
    expect(credential.raw.startsWith(credential.prefix)).toBe(true);
    expect(credential.digest).toMatch(/^[a-f0-9]{64}$/);
    expect(credential.digest).not.toContain(credential.raw);
  });

  it("compares digests through timingSafeEqual and rejects mismatched lengths", () => {
    const first = digestUserCode("ABCD-EFGH-JKLM");
    const second = digestUserCode("ABCD-EFGH-JKLN");

    expect(safeDigestEqual(first, first)).toBe(true);
    expect(safeDigestEqual(first, second)).toBe(false);
    expect(safeDigestEqual(first, `${second}00`)).toBe(false);
    expect(safeDigestEqual.toString()).toContain("timingSafeEqual");
  });
});
