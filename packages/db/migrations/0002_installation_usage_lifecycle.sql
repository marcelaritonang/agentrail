ALTER TABLE "installations" ADD COLUMN "activated_at" timestamp with time zone;
ALTER TABLE "installations" ADD COLUMN "last_seen_at" timestamp with time zone;
CREATE INDEX "installations_project_last_seen_idx" ON "installations" USING btree ("project_id","last_seen_at");
