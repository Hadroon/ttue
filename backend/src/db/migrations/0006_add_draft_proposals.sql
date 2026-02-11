CREATE TABLE IF NOT EXISTS "challenge_draft_proposals" (
  "id" serial PRIMARY KEY NOT NULL,
  "draft_id" integer NOT NULL REFERENCES "challenge_drafts"("id") ON DELETE cascade,
  "proposer_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "content" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "resolved_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "proposal_draft_idx" ON "challenge_draft_proposals" ("draft_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "proposal_proposer_idx" ON "challenge_draft_proposals" ("proposer_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "proposal_status_idx" ON "challenge_draft_proposals" ("status");
