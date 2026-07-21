CREATE TABLE "api_keys" (
	"api_key_id" uuid PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"key_prefix" varchar(32) NOT NULL,
	"key_digest" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"project_id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"payload_mode" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spans" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"project_id" uuid NOT NULL,
	"trace_id" varchar(32) NOT NULL,
	"span_id" varchar(16) NOT NULL,
	"parent_span_id" varchar(16),
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"agent_id" text NOT NULL,
	"on_behalf_of" text,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone NOT NULL,
	"outcome" text NOT NULL,
	"model" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"cost_usd" numeric(20, 8),
	"pricing_unknown" boolean DEFAULT false NOT NULL,
	"pricing_catalog_version" text,
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"payload_ref" text,
	"payload_truncated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "traces" (
	"project_id" uuid NOT NULL,
	"trace_id" varchar(32) NOT NULL,
	"root_span_id" varchar(16),
	"name" text NOT NULL,
	"agent_id" text NOT NULL,
	"on_behalf_of" text,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"outcome" text,
	"completion_state" text,
	"total_cost_usd" numeric(20, 8),
	"pricing_unknown" boolean DEFAULT false NOT NULL,
	"span_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "traces_project_id_trace_id_pk" PRIMARY KEY("project_id","trace_id")
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_project_id_projects_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("project_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spans" ADD CONSTRAINT "spans_trace_fk" FOREIGN KEY ("project_id","trace_id") REFERENCES "public"."traces"("project_id","trace_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "traces" ADD CONSTRAINT "traces_project_id_projects_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("project_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_prefix_unique" ON "api_keys" USING btree ("key_prefix");--> statement-breakpoint
CREATE UNIQUE INDEX "spans_project_span_unique" ON "spans" USING btree ("project_id","span_id");--> statement-breakpoint
CREATE INDEX "spans_project_trace_idx" ON "spans" USING btree ("project_id","trace_id");--> statement-breakpoint
CREATE INDEX "spans_project_kind_started_idx" ON "spans" USING btree ("project_id","kind","started_at");--> statement-breakpoint
CREATE INDEX "traces_project_started_idx" ON "traces" USING btree ("project_id","started_at");