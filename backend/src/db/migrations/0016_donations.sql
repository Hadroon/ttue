CREATE TABLE IF NOT EXISTS "donations" (
	"id" serial PRIMARY KEY NOT NULL,
	"stripe_session_id" text NOT NULL,
	"stripe_payment_intent_id" text,
	"livemode" boolean DEFAULT false NOT NULL,
	"amount" integer NOT NULL,
	"currency" text NOT NULL,
	"donor_email" text,
	"donor_name" text,
	"user_id" integer,
	"challenge_id" integer,
	"challenge_title" text,
	"action_key" text,
	"target_id" text,
	"target_title" text,
	"target_location" text,
	"paid_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "donations_stripe_session_id_unique" UNIQUE("stripe_session_id")
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "donations" ADD CONSTRAINT "donations_user_id_users_id_fk"
		FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "donations" ADD CONSTRAINT "donations_challenge_id_challenges_id_fk"
		FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "donations_challenge_idx" ON "donations" USING btree ("challenge_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "donations_paid_at_idx" ON "donations" USING btree ("paid_at");
