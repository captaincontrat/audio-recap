ALTER TABLE "workspace" ADD COLUMN "scheduled_delete_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "workspace" ADD COLUMN "restored_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "workspace_scheduled_delete_idx" ON "workspace" USING btree ("scheduled_delete_at") WHERE "workspace"."scheduled_delete_at" IS NOT NULL;