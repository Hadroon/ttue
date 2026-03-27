CREATE TABLE "flags" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"content_type" text NOT NULL,
	"content_id" integer NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_at" timestamp,
	"reviewed_by_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "flags" ADD CONSTRAINT "flags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "flags" ADD CONSTRAINT "flags_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "flag_user_content_unique" ON "flags" USING btree ("user_id","content_type","content_id");
--> statement-breakpoint
CREATE INDEX "flag_content_type_idx" ON "flags" USING btree ("content_type","content_id");
--> statement-breakpoint
CREATE INDEX "flag_status_idx" ON "flags" USING btree ("status");
