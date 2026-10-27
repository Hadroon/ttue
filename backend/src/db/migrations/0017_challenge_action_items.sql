CREATE TABLE IF NOT EXISTS "challenge_action_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"challenge_id" integer NOT NULL,
	"action_key" text NOT NULL,
	"kind" text NOT NULL,
	"parent_id" integer,
	"user_id" integer,
	"data" json NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "challenge_action_items" ADD CONSTRAINT "challenge_action_items_challenge_id_challenges_id_fk"
		FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "challenge_action_items" ADD CONSTRAINT "challenge_action_items_parent_id_challenge_action_items_id_fk"
		FOREIGN KEY ("parent_id") REFERENCES "public"."challenge_action_items"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "challenge_action_items" ADD CONSTRAINT "challenge_action_items_user_id_users_id_fk"
		FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "challenge_action_items_list_idx" ON "challenge_action_items" USING btree ("challenge_id","action_key","kind");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "challenge_action_items_parent_idx" ON "challenge_action_items" USING btree ("parent_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "challenge_action_items_user_idx" ON "challenge_action_items" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "challenge_action_items_singleton_unique" ON "challenge_action_items" USING btree ("challenge_id","kind","user_id")
	WHERE "parent_id" IS NULL AND "kind" IN ('lawyer_request', 'bill_draft', 'outreach', 'allocation');
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "challenge_action_items_per_parent_unique" ON "challenge_action_items" USING btree ("challenge_id","kind","user_id","parent_id")
	WHERE "kind" IN ('pledge', 'application', 'proof', 'resolution_cosponsor');
