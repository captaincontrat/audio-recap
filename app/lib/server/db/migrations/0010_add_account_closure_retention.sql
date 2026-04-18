ALTER TABLE "user" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "scheduled_delete_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "user_scheduled_delete_idx" ON "user" USING btree ("scheduled_delete_at") WHERE "user"."scheduled_delete_at" IS NOT NULL;