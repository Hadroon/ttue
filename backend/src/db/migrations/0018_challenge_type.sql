ALTER TABLE "challenges" ADD COLUMN IF NOT EXISTS "type" text DEFAULT 'challenge' NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "challenges" ADD CONSTRAINT "challenge_type_check" CHECK ("challenges"."type" IN ('challenge', 'proposal'));
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "challenge_type_idx" ON "challenges" USING btree ("type");
