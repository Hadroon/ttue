CREATE TABLE "challenge_action_items" (
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
CREATE TABLE "challenge_action_votes" (
	"challenge_id" integer NOT NULL,
	"action_key" text NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "challenge_action_votes_challenge_id_action_key_user_id_pk" PRIMARY KEY("challenge_id","action_key","user_id")
);
--> statement-breakpoint
CREATE TABLE "challenge_actions" (
	"challenge_id" integer NOT NULL,
	"action_key" text NOT NULL,
	"activated_by" integer,
	"activated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "challenge_actions_challenge_id_action_key_pk" PRIMARY KEY("challenge_id","action_key")
);
--> statement-breakpoint
CREATE TABLE "challenge_draft_proposals" (
	"id" serial PRIMARY KEY NOT NULL,
	"draft_id" integer NOT NULL,
	"proposer_id" integer NOT NULL,
	"content" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "challenge_draft_revisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"draft_id" integer NOT NULL,
	"editor_id" integer NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "challenge_draft_votes" (
	"draft_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"value" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "challenge_draft_votes_draft_id_user_id_pk" PRIMARY KEY("draft_id","user_id"),
	CONSTRAINT "challenge_draft_vote_value_check" CHECK ("challenge_draft_votes"."value" IN (-1, 1))
);
--> statement-breakpoint
CREATE TABLE "challenge_drafts" (
	"id" serial PRIMARY KEY NOT NULL,
	"challenge_id" integer NOT NULL,
	"creator_id" integer NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "challenge_drafts_challenge_id_unique" UNIQUE("challenge_id")
);
--> statement-breakpoint
CREATE TABLE "challenge_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"challenge_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "challenge_votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"challenge_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"value" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "challenge_vote_value_check" CHECK ("challenge_votes"."value" = 1)
);
--> statement-breakpoint
CREATE TABLE "challenges" (
	"id" serial PRIMARY KEY NOT NULL,
	"creator_id" integer,
	"domain_id" integer NOT NULL,
	"type" text DEFAULT 'challenge' NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"urgency" text NOT NULL,
	"participant_count" integer DEFAULT 0 NOT NULL,
	"reward_pool" text,
	"deadline" timestamp,
	"tags" json DEFAULT '[]'::json NOT NULL,
	"votes" integer DEFAULT 0 NOT NULL,
	"is_marked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "challenge_type_check" CHECK ("challenges"."type" IN ('challenge', 'proposal'))
);
--> statement-breakpoint
CREATE TABLE "comment_votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"comment_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"value" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "comment_vote_value_check" CHECK ("comment_votes"."value" IN (-1, 1))
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"idea_id" integer,
	"challenge_id" integer,
	"draft_id" integer,
	"author_id" integer NOT NULL,
	"parent_id" integer,
	"score" integer DEFAULT 0 NOT NULL,
	"is_accepted" boolean DEFAULT false NOT NULL,
	"is_marked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "comment_single_target_check" CHECK (num_nonnulls("comments"."idea_id", "comments"."challenge_id", "comments"."draft_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "domains" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"display_order" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "domains_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "donations" (
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
CREATE TABLE "idea_revisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"idea_id" integer NOT NULL,
	"editor_id" integer NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"edit_summary" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idea_tags" (
	"idea_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idea_votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"idea_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"value" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "idea_vote_value_check" CHECK ("idea_votes"."value" IN (-1, 1))
);
--> statement-breakpoint
CREATE TABLE "ideas" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"author_id" integer NOT NULL,
	"challenge_id" integer,
	"score" integer DEFAULT 0 NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"is_closed" boolean DEFAULT false NOT NULL,
	"is_marked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reputation_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"actor_id" integer,
	"domain_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"action_type" text NOT NULL,
	"content_type" text NOT NULL,
	"content_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reputation_audit_amount_not_zero" CHECK ("reputation_audit_logs"."amount" <> 0)
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"use_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tags_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "user_domain_reputation" (
	"user_id" integer NOT NULL,
	"domain_id" integer NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"last_activity_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_domain_reputation_user_id_domain_id_pk" PRIMARY KEY("user_id","domain_id")
);
--> statement-breakpoint
CREATE TABLE "user_follows" (
	"follower_id" integer NOT NULL,
	"followee_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_follows_follower_id_followee_id_pk" PRIMARY KEY("follower_id","followee_id"),
	CONSTRAINT "user_follows_no_self_check" CHECK ("user_follows"."follower_id" <> "user_follows"."followee_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"display_name" text,
	"bio" text,
	"avatar_url" text,
	"location" text,
	"website_url" text,
	"google_id" text,
	"auth_provider" text DEFAULT 'local' NOT NULL,
	"reputation" integer DEFAULT 0 NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"last_login_at" timestamp,
	"previous_login_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_google_id_unique" UNIQUE("google_id")
);
--> statement-breakpoint
ALTER TABLE "challenge_action_items" ADD CONSTRAINT "challenge_action_items_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_action_items" ADD CONSTRAINT "challenge_action_items_parent_id_challenge_action_items_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."challenge_action_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_action_items" ADD CONSTRAINT "challenge_action_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_action_votes" ADD CONSTRAINT "challenge_action_votes_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_action_votes" ADD CONSTRAINT "challenge_action_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_actions" ADD CONSTRAINT "challenge_actions_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_actions" ADD CONSTRAINT "challenge_actions_activated_by_users_id_fk" FOREIGN KEY ("activated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_draft_proposals" ADD CONSTRAINT "challenge_draft_proposals_draft_id_challenge_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."challenge_drafts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_draft_proposals" ADD CONSTRAINT "challenge_draft_proposals_proposer_id_users_id_fk" FOREIGN KEY ("proposer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_draft_revisions" ADD CONSTRAINT "challenge_draft_revisions_draft_id_challenge_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."challenge_drafts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_draft_revisions" ADD CONSTRAINT "challenge_draft_revisions_editor_id_users_id_fk" FOREIGN KEY ("editor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_draft_votes" ADD CONSTRAINT "challenge_draft_votes_draft_id_challenge_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."challenge_drafts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_draft_votes" ADD CONSTRAINT "challenge_draft_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_drafts" ADD CONSTRAINT "challenge_drafts_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_drafts" ADD CONSTRAINT "challenge_drafts_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_links" ADD CONSTRAINT "challenge_links_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_links" ADD CONSTRAINT "challenge_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_votes" ADD CONSTRAINT "challenge_votes_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_votes" ADD CONSTRAINT "challenge_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_creator_id_users_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_votes" ADD CONSTRAINT "comment_votes_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comment_votes" ADD CONSTRAINT "comment_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_idea_id_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."ideas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_draft_id_challenge_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."challenge_drafts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donations" ADD CONSTRAINT "donations_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flags" ADD CONSTRAINT "flags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flags" ADD CONSTRAINT "flags_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_revisions" ADD CONSTRAINT "idea_revisions_idea_id_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."ideas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_revisions" ADD CONSTRAINT "idea_revisions_editor_id_users_id_fk" FOREIGN KEY ("editor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_tags" ADD CONSTRAINT "idea_tags_idea_id_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."ideas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_tags" ADD CONSTRAINT "idea_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_votes" ADD CONSTRAINT "idea_votes_idea_id_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."ideas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "idea_votes" ADD CONSTRAINT "idea_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reputation_audit_logs" ADD CONSTRAINT "reputation_audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reputation_audit_logs" ADD CONSTRAINT "reputation_audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reputation_audit_logs" ADD CONSTRAINT "reputation_audit_logs_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_domain_reputation" ADD CONSTRAINT "user_domain_reputation_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_domain_reputation" ADD CONSTRAINT "user_domain_reputation_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_follower_id_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_follows" ADD CONSTRAINT "user_follows_followee_id_users_id_fk" FOREIGN KEY ("followee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "challenge_action_items_list_idx" ON "challenge_action_items" USING btree ("challenge_id","action_key","kind");--> statement-breakpoint
CREATE INDEX "challenge_action_items_parent_idx" ON "challenge_action_items" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "challenge_action_items_user_idx" ON "challenge_action_items" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "challenge_action_items_singleton_unique" ON "challenge_action_items" USING btree ("challenge_id","kind","user_id") WHERE "challenge_action_items"."parent_id" IS NULL AND "challenge_action_items"."kind" IN ('lawyer_request', 'bill_draft', 'outreach', 'allocation');--> statement-breakpoint
CREATE UNIQUE INDEX "challenge_action_items_per_parent_unique" ON "challenge_action_items" USING btree ("challenge_id","kind","user_id","parent_id") WHERE "challenge_action_items"."kind" IN ('pledge', 'application', 'proof', 'resolution_cosponsor');--> statement-breakpoint
CREATE INDEX "challenge_action_votes_action_idx" ON "challenge_action_votes" USING btree ("challenge_id","action_key");--> statement-breakpoint
CREATE INDEX "proposal_draft_idx" ON "challenge_draft_proposals" USING btree ("draft_id");--> statement-breakpoint
CREATE INDEX "proposal_proposer_idx" ON "challenge_draft_proposals" USING btree ("proposer_id");--> statement-breakpoint
CREATE INDEX "proposal_status_idx" ON "challenge_draft_proposals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "draft_revision_draft_idx" ON "challenge_draft_revisions" USING btree ("draft_id");--> statement-breakpoint
CREATE INDEX "draft_revision_created_at_idx" ON "challenge_draft_revisions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "draft_challenge_idx" ON "challenge_drafts" USING btree ("challenge_id");--> statement-breakpoint
CREATE INDEX "draft_creator_idx" ON "challenge_drafts" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "challenge_links_challenge_idx" ON "challenge_links" USING btree ("challenge_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "challenge_links_challenge_url_unique" ON "challenge_links" USING btree ("challenge_id","url");--> statement-breakpoint
CREATE UNIQUE INDEX "challenge_user_vote_unique" ON "challenge_votes" USING btree ("challenge_id","user_id");--> statement-breakpoint
CREATE INDEX "challenge_creator_idx" ON "challenges" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "challenge_domain_idx" ON "challenges" USING btree ("domain_id");--> statement-breakpoint
CREATE INDEX "challenge_type_idx" ON "challenges" USING btree ("type");--> statement-breakpoint
CREATE INDEX "challenge_category_idx" ON "challenges" USING btree ("category");--> statement-breakpoint
CREATE INDEX "challenge_urgency_idx" ON "challenges" USING btree ("urgency");--> statement-breakpoint
CREATE INDEX "challenge_votes_idx" ON "challenges" USING btree ("votes");--> statement-breakpoint
CREATE INDEX "challenge_deadline_idx" ON "challenges" USING btree ("deadline");--> statement-breakpoint
CREATE UNIQUE INDEX "comment_user_vote_unique" ON "comment_votes" USING btree ("comment_id","user_id");--> statement-breakpoint
CREATE INDEX "comment_idea_idx" ON "comments" USING btree ("idea_id");--> statement-breakpoint
CREATE INDEX "comment_challenge_idx" ON "comments" USING btree ("challenge_id");--> statement-breakpoint
CREATE INDEX "comment_draft_idx" ON "comments" USING btree ("draft_id");--> statement-breakpoint
CREATE INDEX "comment_author_idx" ON "comments" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "comment_parent_idx" ON "comments" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "domain_display_order_idx" ON "domains" USING btree ("display_order");--> statement-breakpoint
CREATE INDEX "donations_challenge_idx" ON "donations" USING btree ("challenge_id");--> statement-breakpoint
CREATE INDEX "donations_paid_at_idx" ON "donations" USING btree ("paid_at");--> statement-breakpoint
CREATE UNIQUE INDEX "flag_user_content_unique" ON "flags" USING btree ("user_id","content_type","content_id");--> statement-breakpoint
CREATE INDEX "flag_content_type_idx" ON "flags" USING btree ("content_type","content_id");--> statement-breakpoint
CREATE INDEX "flag_status_idx" ON "flags" USING btree ("status");--> statement-breakpoint
CREATE INDEX "revision_idea_idx" ON "idea_revisions" USING btree ("idea_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idea_tag_unique" ON "idea_tags" USING btree ("idea_id","tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idea_user_vote_unique" ON "idea_votes" USING btree ("idea_id","user_id");--> statement-breakpoint
CREATE INDEX "idea_author_idx" ON "ideas" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "idea_challenge_idx" ON "ideas" USING btree ("challenge_id");--> statement-breakpoint
CREATE INDEX "idea_score_idx" ON "ideas" USING btree ("score");--> statement-breakpoint
CREATE INDEX "idea_created_at_idx" ON "ideas" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "reputation_audit_user_created_idx" ON "reputation_audit_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "reputation_audit_content_idx" ON "reputation_audit_logs" USING btree ("content_type","content_id");--> statement-breakpoint
CREATE INDEX "user_domain_reputation_user_idx" ON "user_domain_reputation" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_follows_followee_idx" ON "user_follows" USING btree ("followee_id");--> statement-breakpoint
CREATE INDEX "username_idx" ON "users" USING btree ("username");--> statement-breakpoint
CREATE INDEX "email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "google_id_idx" ON "users" USING btree ("google_id");--> statement-breakpoint
INSERT INTO "domains" ("slug", "name", "description", "display_order") VALUES
	('climate-ecology', 'Climate & Ecology', 'Climate resilience, biodiversity, and ecological systems.', 1),
	('resource-economy', 'Resource Economy', 'Housing, infrastructure, production, and resource allocation.', 2),
	('algorithmic-governance', 'Algorithmic Governance', 'Digital systems, public technology, and accountable automation.', 3),
	('open-science', 'Open Science', 'Health, education, research, and shared knowledge.', 4),
	('general-civic', 'General Civic', 'Cross-domain civic work and contributions without a specific domain.', 5);