import { describe, expect, it } from "vitest";

import {
  DeviceCodeRequestSchema,
  DeviceTokenRequestSchema,
  PrivacyModeSchema,
} from "./device.js";

describe("PrivacyModeSchema", () => {
  it("accepts the approved hosted privacy modes", () => {
    expect(PrivacyModeSchema.safeParse("local-only").success).toBe(true);
    expect(PrivacyModeSchema.safeParse("metrics-only").success).toBe(true);
    expect(PrivacyModeSchema.safeParse("evidence-sync").success).toBe(true);
  });

  it("rejects unapproved privacy modes", () => {
    expect(PrivacyModeSchema.safeParse("full-sync").success).toBe(false);
  });
});

describe("DeviceCodeRequestSchema", () => {
  it("accepts Codex and Claude clients with package versions", () => {
    for (const client_type of ["codex", "claude"] as const) {
      expect(
        DeviceCodeRequestSchema.safeParse({
          schema_version: 1,
          client_type,
          package_version: "0.1.2",
        }).success,
      ).toBe(true);
    }
  });

  it("rejects extra fields and oversized package versions", () => {
    expect(
      DeviceCodeRequestSchema.safeParse({
        schema_version: 1,
        client_type: "codex",
        package_version: "0.1.2",
        user_id: "must-not-pass",
      }).success,
    ).toBe(false);

    expect(
      DeviceCodeRequestSchema.safeParse({
        schema_version: 1,
        client_type: "codex",
        package_version: "x".repeat(51),
      }).success,
    ).toBe(false);
  });
});

describe("DeviceTokenRequestSchema", () => {
  it("accepts bounded device codes", () => {
    expect(
      DeviceTokenRequestSchema.safeParse({
        schema_version: 1,
        device_code: "d".repeat(32),
      }).success,
    ).toBe(true);
  });

  it("rejects short, oversized, and metadata-bearing device codes", () => {
    expect(
      DeviceTokenRequestSchema.safeParse({
        schema_version: 1,
        device_code: "d".repeat(31),
      }).success,
    ).toBe(false);

    expect(
      DeviceTokenRequestSchema.safeParse({
        schema_version: 1,
        device_code: "d".repeat(201),
      }).success,
    ).toBe(false);

    expect(
      DeviceTokenRequestSchema.safeParse({
        schema_version: 1,
        device_code: "d".repeat(32),
        project_id: "must-not-pass",
      }).success,
    ).toBe(false);
  });
});
