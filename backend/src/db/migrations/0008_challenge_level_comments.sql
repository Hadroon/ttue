-- Make idea_id nullable so comments can be directly on a challenge (not tied to a specific idea)
ALTER TABLE "comments" ALTER COLUMN "idea_id" DROP NOT NULL;

-- Add optional challenge_id column for challenge-level comments
ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "challenge_id" integer REFERENCES "challenges"("id") ON DELETE CASCADE;

-- Add index for challenge_id lookups
CREATE INDEX IF NOT EXISTS "comment_challenge_idx" ON "comments" ("challenge_id");
