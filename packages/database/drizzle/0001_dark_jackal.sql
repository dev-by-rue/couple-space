CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "users" RENAME COLUMN "auth_user_id" TO "password_hash";--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_auth_user_id_unique";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "display_name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "date_of_birth" date NOT NULL;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_email_unique" UNIQUE("email");