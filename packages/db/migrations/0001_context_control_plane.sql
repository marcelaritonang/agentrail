CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "owner_user_id" text;
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "privacy_mode" text DEFAULT 'local-only' NOT NULL;
--> statement-breakpoint
CREATE TABLE "device_codes" (
	"device_code_id" uuid PRIMARY KEY NOT NULL,
	"device_code_digest" varchar(128) NOT NULL,
	"user_code_digest" varchar(128) NOT NULL,
	"client_type" text NOT NULL,
	"package_version" text NOT NULL,
	"project_id" uuid,
	"approved_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"approved_at" timestamp with time zone,
	"consumed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "installations" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"installation_id" text NOT NULL,
	"credential_prefix" varchar(32) NOT NULL,
	"credential_digest" varchar(128) NOT NULL,
	"client_type" text NOT NULL,
	"package_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "usage_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"installation_id" text NOT NULL,
	"event_id" text NOT NULL,
	"pack_id" text NOT NULL,
	"event_type" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"client" text NOT NULL,
	"package_version" text NOT NULL,
	"status" text NOT NULL,
	"latency_ms" integer NOT NULL,
	"candidate_tokens_estimate" integer NOT NULL,
	"returned_tokens_estimate" integer NOT NULL,
	"source_counts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"warning_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"outcome" text,
	"reason_code" text,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "context_packs" (
	"project_id" uuid NOT NULL,
	"pack_id" text NOT NULL,
	"status" text NOT NULL,
	"candidate_tokens_estimate" integer NOT NULL,
	"returned_tokens_estimate" integer NOT NULL,
	"source_counts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"warning_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"outcome" text,
	"reason_code" text,
	"first_seen_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	CONSTRAINT "context_packs_project_id_pack_id_pk" PRIMARY KEY("project_id","pack_id")
);
--> statement-breakpoint
CREATE TABLE "daily_usage" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"day" date NOT NULL,
	"context_pack_created_count" integer DEFAULT 0 NOT NULL,
	"context_outcome_reported_count" integer DEFAULT 0 NOT NULL,
	"candidate_tokens_estimate" integer DEFAULT 0 NOT NULL,
	"returned_tokens_estimate" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "device_codes" ADD CONSTRAINT "device_codes_project_id_projects_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("project_id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "device_codes" ADD CONSTRAINT "device_codes_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "installations" ADD CONSTRAINT "installations_project_id_projects_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("project_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_project_id_projects_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("project_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "context_packs" ADD CONSTRAINT "context_packs_project_id_projects_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("project_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "daily_usage" ADD CONSTRAINT "daily_usage_project_id_projects_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("project_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "sessions_userId_idx" ON "sessions" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "accounts_userId_idx" ON "accounts" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_provider_account_unique" ON "accounts" USING btree ("provider_id","account_id");
--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");
--> statement-breakpoint
CREATE UNIQUE INDEX "device_codes_device_code_digest_unique" ON "device_codes" USING btree ("device_code_digest");
--> statement-breakpoint
CREATE UNIQUE INDEX "device_codes_user_code_digest_unique" ON "device_codes" USING btree ("user_code_digest");
--> statement-breakpoint
CREATE UNIQUE INDEX "installations_credential_prefix_unique" ON "installations" USING btree ("credential_prefix");
--> statement-breakpoint
CREATE UNIQUE INDEX "installations_project_installation_unique" ON "installations" USING btree ("project_id","installation_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "usage_events_installation_event_unique" ON "usage_events" USING btree ("installation_id","event_id");
--> statement-breakpoint
CREATE INDEX "usage_events_project_occurred_idx" ON "usage_events" USING btree ("project_id","occurred_at");
--> statement-breakpoint
CREATE INDEX "context_packs_project_last_seen_idx" ON "context_packs" USING btree ("project_id","last_seen_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "daily_usage_project_day_unique" ON "daily_usage" USING btree ("project_id","day");
