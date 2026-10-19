CREATE TABLE IF NOT EXISTS "challenge_action_votes" (
	"challenge_id" integer NOT NULL,
	"action_key" text NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "challenge_action_votes_challenge_id_action_key_user_id_pk" PRIMARY KEY("challenge_id","action_key","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "challenge_actions" (
	"challenge_id" integer NOT NULL,
	"action_key" text NOT NULL,
	"activated_by" integer,
	"activated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "challenge_actions_challenge_id_action_key_pk" PRIMARY KEY("challenge_id","action_key")
);
--> statement-breakpoint
ALTER TABLE "challenge_action_votes" ADD CONSTRAINT "challenge_action_votes_challenge_id_challenges_id_fk"
	FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "challenge_action_votes" ADD CONSTRAINT "challenge_action_votes_user_id_users_id_fk"
	FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "challenge_actions" ADD CONSTRAINT "challenge_actions_challenge_id_challenges_id_fk"
	FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "challenge_actions" ADD CONSTRAINT "challenge_actions_activated_by_users_id_fk"
	FOREIGN KEY ("activated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "challenge_action_votes_action_idx" ON "challenge_action_votes" USING btree ("challenge_id","action_key");
