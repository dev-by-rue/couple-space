-- One-off reset before Gate A (E-13): ids now come from keys, so the old
-- catalogue and every session on it go. Never copy this after Gate A.
DELETE FROM "session_reveals";--> statement-breakpoint
DELETE FROM "session_responses";--> statement-breakpoint
DELETE FROM "conversation_sessions";--> statement-breakpoint
DELETE FROM "prompts";--> statement-breakpoint
DELETE FROM "prompt_themes";--> statement-breakpoint

CREATE TABLE "prompt_tag_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prompt_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prompt_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prompt_tags_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "prompts" ADD COLUMN "key" text;--> statement-breakpoint
ALTER TABLE "prompts" ADD COLUMN "parent_prompt_id" uuid;--> statement-breakpoint
ALTER TABLE "prompts" ADD COLUMN "depth" text;--> statement-breakpoint
ALTER TABLE "conversation_sessions" ADD COLUMN "parent_session_id" uuid;--> statement-breakpoint
ALTER TABLE "prompt_tag_links" ADD CONSTRAINT "prompt_tag_links_prompt_id_prompts_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."prompts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_tag_links" ADD CONSTRAINT "prompt_tag_links_tag_id_prompt_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."prompt_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompts" ADD CONSTRAINT "prompts_parent_prompt_id_prompts_id_fk" FOREIGN KEY ("parent_prompt_id") REFERENCES "public"."prompts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_sessions" ADD CONSTRAINT "conversation_sessions_parent_session_id_conversation_sessions_id_fk" FOREIGN KEY ("parent_session_id") REFERENCES "public"."conversation_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_sessions_parent_prompt_unique" ON "conversation_sessions" USING btree ("parent_session_id","prompt_id");--> statement-breakpoint
ALTER TABLE "prompts" ADD CONSTRAINT "prompts_key_unique" UNIQUE("key");--> statement-breakpoint
ALTER TABLE "prompts" ADD CONSTRAINT "prompts_depth_preset" CHECK ("prompts"."depth" is null or "prompts"."depth" in ('light', 'medium', 'deep'));--> statement-breakpoint
ALTER TABLE "prompts" ADD CONSTRAINT "prompts_catalogue_key_depth" CHECK ("prompts"."kind" not in ('curated', 'follow_up') or ("prompts"."key" is not null and "prompts"."depth" is not null));