ALTER TABLE "traces" ADD COLUMN "pack_id" text;

CREATE TABLE "project_memories" (
  "project_id" uuid NOT NULL REFERENCES "projects"("project_id") ON DELETE cascade,
  "memory_id" text NOT NULL,
  "revision" integer NOT NULL,
  "type" text NOT NULL,
  "status" text NOT NULL,
  "statement_redacted" text,
  "scope" text NOT NULL,
  "source_kind" text NOT NULL,
  "expires_at" timestamp with time zone,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "tombstone" jsonb,
  CONSTRAINT "project_memories_pkey" PRIMARY KEY ("project_id", "memory_id")
);

CREATE TABLE "receipts" (
  "project_id" uuid NOT NULL REFERENCES "projects"("project_id") ON DELETE cascade,
  "receipt_id" text NOT NULL,
  "pack_id" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "status" text NOT NULL,
  "candidate_tokens_estimate" integer NOT NULL,
  "returned_tokens_estimate" integer NOT NULL,
  "context_reduction_estimate" integer NOT NULL,
  "measurement_method" text NOT NULL,
  "measurement_confidence" text NOT NULL,
  "source_count" integer NOT NULL,
  "warning_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "evidence_mode" text NOT NULL,
  CONSTRAINT "receipts_pkey" PRIMARY KEY ("project_id", "receipt_id")
);

CREATE TABLE "context_sources" (
  "project_id" uuid NOT NULL,
  "receipt_id" text NOT NULL,
  "source_id" text NOT NULL,
  "trust_class" text NOT NULL,
  "relative_path" text NOT NULL,
  "locator" jsonb NOT NULL,
  "content_hash" varchar(64) NOT NULL,
  "selection_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "excerpt_redacted" text,
  CONSTRAINT "context_sources_pkey" PRIMARY KEY ("project_id", "receipt_id", "source_id"),
  CONSTRAINT "context_sources_receipt_fk" FOREIGN KEY ("project_id", "receipt_id") REFERENCES "receipts"("project_id", "receipt_id") ON DELETE cascade
);

CREATE TABLE "outcome_reports" (
  "project_id" uuid NOT NULL,
  "outcome_id" text NOT NULL,
  "receipt_id" text NOT NULL,
  "pack_id" text NOT NULL,
  "outcome" text NOT NULL,
  "reason_code" text NOT NULL,
  "reported_at" timestamp with time zone NOT NULL,
  CONSTRAINT "outcome_reports_pkey" PRIMARY KEY ("project_id", "outcome_id"),
  CONSTRAINT "outcome_reports_receipt_fk" FOREIGN KEY ("project_id", "receipt_id") REFERENCES "receipts"("project_id", "receipt_id") ON DELETE cascade
);

CREATE TABLE "shared_receipts" (
  "project_id" uuid NOT NULL,
  "receipt_id" text NOT NULL,
  "share_token_digest" varchar(128) NOT NULL,
  "fields" jsonb NOT NULL,
  "reviewed_at" timestamp with time zone NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "shared_receipts_pkey" PRIMARY KEY ("project_id", "receipt_id"),
  CONSTRAINT "shared_receipts_receipt_fk" FOREIGN KEY ("project_id", "receipt_id") REFERENCES "receipts"("project_id", "receipt_id") ON DELETE cascade
);

CREATE INDEX "traces_project_pack_idx" ON "traces" USING btree ("project_id", "pack_id");
CREATE INDEX "project_memories_project_status_idx" ON "project_memories" USING btree ("project_id", "status");
CREATE INDEX "receipts_project_pack_idx" ON "receipts" USING btree ("project_id", "pack_id");
CREATE INDEX "receipts_project_created_idx" ON "receipts" USING btree ("project_id", "created_at");
CREATE INDEX "context_sources_project_receipt_idx" ON "context_sources" USING btree ("project_id", "receipt_id");
CREATE INDEX "outcome_reports_project_receipt_idx" ON "outcome_reports" USING btree ("project_id", "receipt_id");
CREATE UNIQUE INDEX "shared_receipts_token_digest_unique" ON "shared_receipts" USING btree ("share_token_digest");
