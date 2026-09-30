-- Move replies that ended up in a different thread than their parent into the parent's thread
UPDATE "comments" AS c
SET "idea_id" = p."idea_id", "challenge_id" = p."challenge_id", "draft_id" = p."draft_id"
FROM "comments" AS p
WHERE p."id" = c."parent_id"
  AND (c."idea_id" IS DISTINCT FROM p."idea_id"
    OR c."challenge_id" IS DISTINCT FROM p."challenge_id"
    OR c."draft_id" IS DISTINCT FROM p."draft_id");
--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comment_single_target_check" CHECK (num_nonnulls("idea_id", "challenge_id", "draft_id") = 1);
