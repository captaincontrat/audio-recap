CREATE TYPE "public"."workspace_invitation_status" AS ENUM('pending', 'accepted', 'revoked', 'expired', 'superseded');--> statement-breakpoint
CREATE TABLE "workspace_invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"email" text NOT NULL,
	"role" "workspace_role" NOT NULL,
	"status" "workspace_invitation_status" DEFAULT 'pending' NOT NULL,
	"token_hash" text,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"consumed_by_user_id" text,
	"invited_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspace_invitation" ADD CONSTRAINT "workspace_invitation_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invitation" ADD CONSTRAINT "workspace_invitation_consumed_by_user_id_user_id_fk" FOREIGN KEY ("consumed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invitation" ADD CONSTRAINT "workspace_invitation_invited_by_user_id_user_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_invitation_pending_unique" ON "workspace_invitation" USING btree ("workspace_id","email") WHERE "workspace_invitation"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_invitation_token_hash_unique" ON "workspace_invitation" USING btree ("token_hash") WHERE "workspace_invitation"."status" = 'pending' AND "workspace_invitation"."token_hash" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "workspace_invitation_workspace_status_idx" ON "workspace_invitation" USING btree ("workspace_id","status");--> statement-breakpoint
CREATE INDEX "workspace_invitation_email_idx" ON "workspace_invitation" USING btree ("email");