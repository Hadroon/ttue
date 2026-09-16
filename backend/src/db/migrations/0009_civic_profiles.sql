ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "location" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "website_url" text;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "domains" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"display_order" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "domains_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "domain_display_order_idx" ON "domains" USING btree ("display_order");
--> statement-breakpoint

INSERT INTO "domains" ("slug", "name", "description", "display_order") VALUES
	('climate-ecology', 'Climate & Ecology', 'Climate resilience, biodiversity, and ecological systems.', 1),
	('resource-economy', 'Resource Economy', 'Housing, infrastructure, production, and resource allocation.', 2),
	('algorithmic-governance', 'Algorithmic Governance', 'Digital systems, public technology, and accountable automation.', 3),
	('open-science', 'Open Science', 'Health, education, research, and shared knowledge.', 4),
	('general-civic', 'General Civic', 'Cross-domain civic work and contributions without a specific domain.', 5)
ON CONFLICT ("slug") DO UPDATE SET
	"name" = EXCLUDED."name",
	"description" = EXCLUDED."description",
	"display_order" = EXCLUDED."display_order";
--> statement-breakpoint

ALTER TABLE "challenges" ADD COLUMN IF NOT EXISTS "creator_id" integer;
--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN IF NOT EXISTS "domain_id" integer;
--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_creator_id_users_id_fk"
	FOREIGN KEY ("creator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_domain_id_domains_id_fk"
	FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint

UPDATE "challenges" AS challenge
SET "creator_id" = draft."creator_id"
FROM "challenge_drafts" AS draft
WHERE draft."challenge_id" = challenge."id"
	AND challenge."creator_id" IS NULL;
--> statement-breakpoint

UPDATE "challenges" AS challenge
SET "domain_id" = domain."id"
FROM "domains" AS domain
WHERE domain."slug" = CASE lower(challenge."category")
	WHEN 'environment' THEN 'climate-ecology'
	WHEN 'economy' THEN 'resource-economy'
	WHEN 'housing' THEN 'resource-economy'
	WHEN 'infrastructure' THEN 'resource-economy'
	WHEN 'technology' THEN 'algorithmic-governance'
	WHEN 'education' THEN 'open-science'
	WHEN 'health' THEN 'open-science'
	ELSE 'general-civic'
END;
--> statement-breakpoint
ALTER TABLE "challenges" ALTER COLUMN "domain_id" SET NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "challenge_creator_idx" ON "challenges" USING btree ("creator_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "challenge_domain_idx" ON "challenges" USING btree ("domain_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "user_domain_reputation" (
	"user_id" integer NOT NULL,
	"domain_id" integer NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"last_activity_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_domain_reputation_user_id_domain_id_pk" PRIMARY KEY("user_id", "domain_id"),
	CONSTRAINT "user_domain_reputation_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "user_domain_reputation_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_domain_reputation_user_idx" ON "user_domain_reputation" USING btree ("user_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "reputation_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"actor_id" integer,
	"domain_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"action_type" text NOT NULL,
	"content_type" text NOT NULL,
	"content_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reputation_audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "reputation_audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action,
	CONSTRAINT "reputation_audit_logs_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE restrict ON UPDATE no action,
	CONSTRAINT "reputation_audit_amount_not_zero" CHECK ("amount" <> 0)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reputation_audit_user_created_idx" ON "reputation_audit_logs" USING btree ("user_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reputation_audit_content_idx" ON "reputation_audit_logs" USING btree ("content_type", "content_id");
--> statement-breakpoint

DELETE FROM "idea_votes" AS vote
USING "ideas" AS idea
WHERE vote."idea_id" = idea."id" AND vote."user_id" = idea."author_id";
--> statement-breakpoint
DELETE FROM "comment_votes" AS vote
USING "comments" AS comment
WHERE vote."comment_id" = comment."id" AND vote."user_id" = comment."author_id";
--> statement-breakpoint
DELETE FROM "challenge_votes" AS vote
USING "challenges" AS challenge
WHERE vote."challenge_id" = challenge."id" AND vote."user_id" = challenge."creator_id";
--> statement-breakpoint

UPDATE "ideas" AS idea
SET "score" = COALESCE((
	SELECT sum(vote."value")::integer FROM "idea_votes" AS vote WHERE vote."idea_id" = idea."id"
), 0);
--> statement-breakpoint
UPDATE "comments" AS comment
SET "score" = COALESCE((
	SELECT sum(vote."value")::integer FROM "comment_votes" AS vote WHERE vote."comment_id" = comment."id"
), 0);
--> statement-breakpoint
UPDATE "challenges" AS challenge
SET "votes" = COALESCE((
	SELECT sum(vote."value")::integer FROM "challenge_votes" AS vote WHERE vote."challenge_id" = challenge."id"
), 0);
--> statement-breakpoint

DELETE FROM "reputation_audit_logs";
--> statement-breakpoint
DELETE FROM "user_domain_reputation";
--> statement-breakpoint

INSERT INTO "reputation_audit_logs" ("user_id", "actor_id", "domain_id", "amount", "action_type", "content_type", "content_id", "created_at")
SELECT idea."author_id", vote."user_id", COALESCE(challenge."domain_id", general."id"), vote."value", 'IDEA_VOTE', 'idea', idea."id", vote."created_at"
FROM "idea_votes" AS vote
JOIN "ideas" AS idea ON idea."id" = vote."idea_id"
LEFT JOIN "challenges" AS challenge ON challenge."id" = idea."challenge_id"
CROSS JOIN LATERAL (SELECT "id" FROM "domains" WHERE "slug" = 'general-civic') AS general;
--> statement-breakpoint
INSERT INTO "reputation_audit_logs" ("user_id", "actor_id", "domain_id", "amount", "action_type", "content_type", "content_id", "created_at")
SELECT comment."author_id", vote."user_id", COALESCE(direct_challenge."domain_id", idea_challenge."domain_id", general."id"), vote."value", 'COMMENT_VOTE', 'comment', comment."id", vote."created_at"
FROM "comment_votes" AS vote
JOIN "comments" AS comment ON comment."id" = vote."comment_id"
LEFT JOIN "challenges" AS direct_challenge ON direct_challenge."id" = comment."challenge_id"
LEFT JOIN "ideas" AS idea ON idea."id" = comment."idea_id"
LEFT JOIN "challenges" AS idea_challenge ON idea_challenge."id" = idea."challenge_id"
CROSS JOIN LATERAL (SELECT "id" FROM "domains" WHERE "slug" = 'general-civic') AS general;
--> statement-breakpoint
INSERT INTO "reputation_audit_logs" ("user_id", "actor_id", "domain_id", "amount", "action_type", "content_type", "content_id", "created_at")
SELECT challenge."creator_id", vote."user_id", challenge."domain_id", vote."value", 'CHALLENGE_VOTE', 'challenge', challenge."id", vote."created_at"
FROM "challenge_votes" AS vote
JOIN "challenges" AS challenge ON challenge."id" = vote."challenge_id"
WHERE challenge."creator_id" IS NOT NULL;
--> statement-breakpoint

INSERT INTO "user_domain_reputation" ("user_id", "domain_id", "score", "last_activity_at")
SELECT "user_id", "domain_id", sum("amount")::integer, max("created_at")
FROM "reputation_audit_logs"
GROUP BY "user_id", "domain_id";
--> statement-breakpoint
UPDATE "users" AS user_account
SET "reputation" = COALESCE((
	SELECT sum(domain_reputation."score")::integer
	FROM "user_domain_reputation" AS domain_reputation
	WHERE domain_reputation."user_id" = user_account."id"
), 0);
--> statement-breakpoint

ALTER TABLE "idea_votes" ADD CONSTRAINT "idea_vote_value_check" CHECK ("value" IN (-1, 1));
--> statement-breakpoint
ALTER TABLE "comment_votes" ADD CONSTRAINT "comment_vote_value_check" CHECK ("value" IN (-1, 1));
--> statement-breakpoint
ALTER TABLE "challenge_votes" ADD CONSTRAINT "challenge_vote_value_check" CHECK ("value" = 1);