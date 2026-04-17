CREATE TYPE "public"."media_normalization_policy_value" AS ENUM('optional', 'required');--> statement-breakpoint
CREATE TYPE "public"."transcript_failure_code" AS ENUM('validation_failed', 'processing_failed');--> statement-breakpoint
CREATE TYPE "public"."transcript_source_media_kind" AS ENUM('audio', 'video');--> statement-breakpoint
CREATE TYPE "public"."transcript_status" AS ENUM('queued', 'preprocessing', 'transcribing', 'generating_recap', 'generating_title', 'finalizing', 'retrying', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "app_setting" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processing_job" (
	"id" text PRIMARY KEY NOT NULL,
	"transcript_id" text NOT NULL,
	"status" "transcript_status" DEFAULT 'queued' NOT NULL,
	"media_normalization_policy_snapshot" "media_normalization_policy_value" NOT NULL,
	"media_input_kind" text NOT NULL,
	"upload_id" text NOT NULL,
	"media_input_key" text,
	"media_content_type" text,
	"notes_input_key" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"last_failure_code" "transcript_failure_code",
	"last_failure_summary" text,
	"transient_cleanup_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transcript" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"created_by_user_id" text,
	"status" "transcript_status" DEFAULT 'queued' NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"transcript_markdown" text DEFAULT '' NOT NULL,
	"recap_markdown" text DEFAULT '' NOT NULL,
	"source_media_kind" "transcript_source_media_kind" NOT NULL,
	"original_duration_sec" real,
	"submitted_with_notes" boolean DEFAULT false NOT NULL,
	"failure_code" "transcript_failure_code",
	"failure_summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "processing_job" ADD CONSTRAINT "processing_job_transcript_id_transcript_id_fk" FOREIGN KEY ("transcript_id") REFERENCES "public"."transcript"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript" ADD CONSTRAINT "transcript_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript" ADD CONSTRAINT "transcript_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "processing_job_transcript_unique" ON "processing_job" USING btree ("transcript_id");--> statement-breakpoint
CREATE INDEX "processing_job_status_idx" ON "processing_job" USING btree ("status");--> statement-breakpoint
CREATE INDEX "transcript_workspace_status_idx" ON "transcript" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "transcript_workspace_created_idx" ON "transcript" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "transcript_created_by_idx" ON "transcript" USING btree ("created_by_user_id");