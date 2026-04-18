DROP INDEX "transcript_workspace_title_ci_idx";--> statement-breakpoint
ALTER TABLE "transcript" ADD COLUMN "custom_title" text;--> statement-breakpoint
ALTER TABLE "transcript" ADD COLUMN "tags" text[] DEFAULT ARRAY[]::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "transcript" ADD COLUMN "tag_sort_key" text;--> statement-breakpoint
ALTER TABLE "transcript" ADD COLUMN "is_important" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "transcript_workspace_important_idx" ON "transcript" USING btree ("workspace_id","is_important");--> statement-breakpoint
CREATE INDEX "transcript_workspace_tag_sort_key_idx" ON "transcript" USING btree ("workspace_id","tag_sort_key");--> statement-breakpoint
CREATE INDEX "transcript_tags_gin_idx" ON "transcript" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "transcript_workspace_title_ci_idx" ON "transcript" USING btree ("workspace_id",lower(coalesce("custom_title", "title")));