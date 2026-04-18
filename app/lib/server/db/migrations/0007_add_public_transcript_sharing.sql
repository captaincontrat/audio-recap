ALTER TABLE "transcript" ADD COLUMN "is_publicly_shared" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "transcript" ADD COLUMN "public_share_id" text;--> statement-breakpoint
ALTER TABLE "transcript" ADD COLUMN "share_secret_id" text;--> statement-breakpoint
ALTER TABLE "transcript" ADD COLUMN "share_updated_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "transcript_workspace_shared_idx" ON "transcript" USING btree ("workspace_id","is_publicly_shared");--> statement-breakpoint
CREATE UNIQUE INDEX "transcript_public_share_id_unique" ON "transcript" USING btree ("public_share_id") WHERE "transcript"."public_share_id" IS NOT NULL;