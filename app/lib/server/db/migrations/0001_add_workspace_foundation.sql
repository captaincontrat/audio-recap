CREATE TYPE "public"."workspace_role" AS ENUM('read_only', 'member', 'admin');--> statement-breakpoint
CREATE TYPE "public"."workspace_type" AS ENUM('personal', 'team');--> statement-breakpoint
CREATE TABLE "workspace" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "workspace_type" NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"slug" text NOT NULL,
	"personal_owner_user_id" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_membership" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" "workspace_role" NOT NULL,
	"last_accessed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspace" ADD CONSTRAINT "workspace_personal_owner_user_id_user_id_fk" FOREIGN KEY ("personal_owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_membership" ADD CONSTRAINT "workspace_membership_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_membership" ADD CONSTRAINT "workspace_membership_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_slug_unique" ON "workspace" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_personal_owner_unique" ON "workspace" USING btree ("personal_owner_user_id") WHERE "workspace"."personal_owner_user_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_membership_workspace_user_unique" ON "workspace_membership" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE INDEX "workspace_membership_user_idx" ON "workspace_membership" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "workspace_membership_workspace_role_idx" ON "workspace_membership" USING btree ("workspace_id","role");