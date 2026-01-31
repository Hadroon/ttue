ALTER TABLE "posts" ADD COLUMN "challenge_id" integer;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "post_challenge_idx" ON "posts" USING btree ("challenge_id");