ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_login_at" timestamp;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "previous_login_at" timestamp;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "user_follows" (
	"follower_id" integer NOT NULL,
	"followee_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_follows_follower_id_followee_id_pk" PRIMARY KEY("follower_id","followee_id"),
	CONSTRAINT "user_follows_no_self_check" CHECK ("follower_id" <> "followee_id")
);
--> statement-breakpoint
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_follower_id_users_id_fk"
	FOREIGN KEY ("follower_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_followee_id_users_id_fk"
	FOREIGN KEY ("followee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_follows_followee_idx" ON "user_follows" USING btree ("followee_id");
