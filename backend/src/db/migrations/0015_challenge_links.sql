CREATE TABLE IF NOT EXISTS "challenge_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"challenge_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "challenge_links" ADD CONSTRAINT "challenge_links_challenge_id_challenges_id_fk"
	FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "challenge_links" ADD CONSTRAINT "challenge_links_user_id_users_id_fk"
	FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "challenge_links_challenge_idx" ON "challenge_links" USING btree ("challenge_id","created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "challenge_links_challenge_url_unique" ON "challenge_links" USING btree ("challenge_id","url");
