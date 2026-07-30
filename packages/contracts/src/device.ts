import { z } from "zod";

export const PrivacyModeSchema = z.enum([
  "local-only",
  "metrics-only",
  "evidence-sync",
]);

export const DeviceCodeRequestSchema = z
  .object({
    schema_version: z.literal(1),
    client_type: z.enum(["codex", "claude"]),
    package_version: z.string().min(1).max(50),
  })
  .strict();

export const DeviceTokenRequestSchema = z
  .object({
    schema_version: z.literal(1),
    device_code: z.string().min(32).max(200),
  })
  .strict();

export type PrivacyMode = z.infer<typeof PrivacyModeSchema>;
export type DeviceCodeRequest = z.infer<typeof DeviceCodeRequestSchema>;
export type DeviceTokenRequest = z.infer<typeof DeviceTokenRequestSchema>;
