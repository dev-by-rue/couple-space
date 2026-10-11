ALTER TABLE "prompt_themes" ADD COLUMN "slug" text;--> statement-breakpoint
UPDATE "prompt_themes" SET "slug" = "id"::text WHERE "slug" IS NULL;
ALTER TABLE "prompt_themes" ALTER COLUMN "slug" SET NOT NULL;
ALTER TABLE "prompt_themes" ADD CONSTRAINT "prompt_themes_slug_unique" UNIQUE("slug");