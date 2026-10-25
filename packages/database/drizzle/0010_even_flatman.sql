ALTER TABLE "prompts" ADD COLUMN "parent_prmopt_id" uuid;--> statement-breakpoint
ALTER TABLE "conversation_sessions" ADD COLUMN "parent_session_id" uuid;--> statement-breakpoint
ALTER TABLE "prompts" ADD CONSTRAINT "prompts_parent_prmopt_id_prompts_id_fk" FOREIGN KEY ("parent_prmopt_id") REFERENCES "public"."prompts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_sessions" ADD CONSTRAINT "conversation_sessions_parent_session_id_conversation_sessions_id_fk" FOREIGN KEY ("parent_session_id") REFERENCES "public"."conversation_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "conversation_sessions_parent_prompt_unique" ON "conversation_sessions" USING btree ("parent_session_id","prompt_id");