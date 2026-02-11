-- Add challenge drafts and revisions
-- This migration adds tables for challenge draft workspace with version history

-- Create challenge_drafts table
CREATE TABLE IF NOT EXISTS "challenge_drafts" (
	"id" serial PRIMARY KEY NOT NULL,
	"challenge_id" integer NOT NULL,
	"creator_id" integer NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "challenge_drafts_challenge_id_unique" UNIQUE("challenge_id")
);

-- Create challenge_draft_revisions table
CREATE TABLE IF NOT EXISTS "challenge_draft_revisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"draft_id" integer NOT NULL,
	"editor_id" integer NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

-- Add foreign key constraints for challenge_drafts
ALTER TABLE "challenge_drafts" ADD CONSTRAINT "challenge_drafts_challenge_id_challenges_id_fk" 
  FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "challenge_drafts" ADD CONSTRAINT "challenge_drafts_creator_id_users_id_fk" 
  FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;

-- Add foreign key constraints for challenge_draft_revisions
ALTER TABLE "challenge_draft_revisions" ADD CONSTRAINT "challenge_draft_revisions_draft_id_challenge_drafts_id_fk" 
  FOREIGN KEY ("draft_id") REFERENCES "public"."challenge_drafts"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "challenge_draft_revisions" ADD CONSTRAINT "challenge_draft_revisions_editor_id_users_id_fk" 
  FOREIGN KEY ("editor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;

-- Create indexes
CREATE INDEX IF NOT EXISTS "draft_challenge_idx" ON "challenge_drafts" USING btree ("challenge_id");
CREATE INDEX IF NOT EXISTS "draft_creator_idx" ON "challenge_drafts" USING btree ("creator_id");
CREATE INDEX IF NOT EXISTS "draft_revision_draft_idx" ON "challenge_draft_revisions" USING btree ("draft_id");
CREATE INDEX IF NOT EXISTS "draft_revision_created_at_idx" ON "challenge_draft_revisions" USING btree ("created_at");

