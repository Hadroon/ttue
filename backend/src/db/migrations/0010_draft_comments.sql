ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "draft_id" integer REFERENCES "challenge_drafts"("id") ON DELETE CASCADE;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comment_draft_idx" ON "comments" ("draft_id");
