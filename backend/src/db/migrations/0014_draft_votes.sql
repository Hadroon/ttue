CREATE TABLE IF NOT EXISTS "challenge_draft_votes" (
	"draft_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"value" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "challenge_draft_votes_draft_id_user_id_pk" PRIMARY KEY("draft_id","user_id"),
	CONSTRAINT "challenge_draft_vote_value_check" CHECK ("challenge_draft_votes"."value" IN (-1, 1))
);
--> statement-breakpoint
ALTER TABLE "challenge_draft_votes" ADD CONSTRAINT "challenge_draft_votes_draft_id_challenge_drafts_id_fk"
	FOREIGN KEY ("draft_id") REFERENCES "public"."challenge_drafts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "challenge_draft_votes" ADD CONSTRAINT "challenge_draft_votes_user_id_users_id_fk"
	FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
