import { z } from "zod";

export const MAX_EVIDENCE_SOURCES = 100;
export const MAX_EVIDENCE_ENVELOPE_BYTES = 240 * 1024;

const evidenceIdSchema = (prefix: string) =>
  z.string().regex(new RegExp(`^${prefix}_[A-Za-z0-9_-]{24,}$`));

export const TrustClassSchema = z.enum([
  "trusted_instruction",
  "project_source",
  "project_documentation",
  "project_memory",
  "untrusted_content",
]);

export const EvidenceSourceSchema = z
  .object({
    source_id: z.string().min(24).max(100),
    trust_class: TrustClassSchema,
    relative_path: z
      .string()
      .min(1)
      .max(500)
      .superRefine(validateSafeRelativePath),
    locator: z
      .object({
        start_line: z.number().int().positive(),
        end_line: z.number().int().positive(),
        symbol: z.string().max(200).nullable(),
      })
      .strict(),
    content_hash: z.string().regex(/^[0-9a-f]{64}$/),
    selection_reasons: z.array(z.string().max(100)).max(20),
    excerpt_redacted: z.string().max(8_000).optional(),
  })
  .strict()
  .superRefine((source, context) => {
    if (source.locator.end_line < source.locator.start_line) {
      context.addIssue({
        code: "custom",
        path: ["locator", "end_line"],
        message: "end_line cannot precede start_line",
      });
    }
  });

export const EvidenceEnvelopeSchema = z
  .object({
    schema_version: z.literal(1),
    envelope_id: evidenceIdSchema("env"),
    receipt_id: evidenceIdSchema("rcpt"),
    pack_id: evidenceIdSchema("cp"),
    created_at: z.iso.datetime(),
    sources: z.array(EvidenceSourceSchema).max(MAX_EVIDENCE_SOURCES),
  })
  .strict();

export function createEvidenceEnvelopeSchema(
  options: { maxBodyBytes?: number } = {},
) {
  return EvidenceEnvelopeSchema.superRefine((envelope, context) => {
    const maxBodyBytes =
      options.maxBodyBytes ?? MAX_EVIDENCE_ENVELOPE_BYTES;

    if (utf8ByteLength(JSON.stringify(envelope)) > maxBodyBytes) {
      context.addIssue({
        code: "custom",
        path: ["sources"],
        message: `serialized evidence envelope exceeds ${maxBodyBytes} bytes`,
      });
    }
  });
}

export type EvidenceSource = z.infer<typeof EvidenceSourceSchema>;
export type EvidenceEnvelope = z.infer<typeof EvidenceEnvelopeSchema>;

function validateSafeRelativePath(
  value: string,
  context: z.RefinementCtx,
): void {
  const issue = (message: string) =>
    context.addIssue({
      code: "custom",
      message,
    });

  if (value.includes("\0")) {
    issue("relative_path cannot contain NUL bytes");
    return;
  }

  const normalized = value.replaceAll("\\", "/");

  if (
    normalized.startsWith("/") ||
    normalized.startsWith("//") ||
    /^[A-Za-z]:\//.test(normalized)
  ) {
    issue("relative_path must not be absolute");
    return;
  }

  const segments = normalized.split("/");
  if (segments.some((segment) => segment === "..")) {
    issue("relative_path must not traverse parent directories");
    return;
  }

  if (segments.some((segment) => segment.length === 0 || segment === ".")) {
    issue("relative_path must use explicit file segments");
    return;
  }

  if (segments.some(isCredentialLikeSegment)) {
    issue("relative_path must not point at credential-like files");
    return;
  }

  if (segments.some(isSensitiveEnvironmentKey)) {
    issue("relative_path must not be an environment key");
  }
}

function isCredentialLikeSegment(segment: string): boolean {
  const lower = segment.toLowerCase();
  return (
    lower === ".env" ||
    lower === ".npmrc" ||
    lower === "id_rsa" ||
    lower === "id_dsa" ||
    lower === "id_ed25519" ||
    lower.endsWith(".pem") ||
    lower.endsWith(".key") ||
    lower.includes("credential") ||
    lower.includes("secret") ||
    lower.includes("token")
  );
}

function isSensitiveEnvironmentKey(segment: string): boolean {
  return /^(?:AWS_SECRET_ACCESS_KEY|DATABASE_URL|.*(?:SECRET|TOKEN|PASSWORD|PRIVATE_KEY).*)$/.test(
    segment,
  );
}

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}
