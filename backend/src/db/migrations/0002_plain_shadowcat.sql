CREATE TABLE "challenge_votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"challenge_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"value" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "challenges" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"urgency" text NOT NULL,
	"participant_count" integer DEFAULT 0 NOT NULL,
	"reward_pool" text,
	"deadline" timestamp,
	"tags" json DEFAULT '[]'::json NOT NULL,
	"votes" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "challenge_votes" ADD CONSTRAINT "challenge_votes_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_votes" ADD CONSTRAINT "challenge_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "challenge_user_vote_unique" ON "challenge_votes" USING btree ("challenge_id","user_id");--> statement-breakpoint
CREATE INDEX "challenge_category_idx" ON "challenges" USING btree ("category");--> statement-breakpoint
CREATE INDEX "challenge_urgency_idx" ON "challenges" USING btree ("urgency");--> statement-breakpoint
CREATE INDEX "challenge_votes_idx" ON "challenges" USING btree ("votes");--> statement-breakpoint
CREATE INDEX "challenge_deadline_idx" ON "challenges" USING btree ("deadline");