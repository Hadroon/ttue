import { pgTable, serial, text, integer, timestamp, boolean, index, uniqueIndex, json, primaryKey, check, type AnyPgColumn } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"), // Nullable for OAuth users
  displayName: text("display_name"),
  bio: text("bio"),
  avatarUrl: text("avatar_url"), // For Google profile picture
  location: text("location"),
  websiteUrl: text("website_url"),
  googleId: text("google_id").unique(), // Google OAuth ID
  authProvider: text("auth_provider").default("local").notNull(), // 'local' or 'google'
  reputation: integer("reputation").default(0).notNull(),
  isAdmin: boolean("is_admin").default(false).notNull(),
  lastLoginAt: timestamp("last_login_at"),
  previousLoginAt: timestamp("previous_login_at"), // Login before the current one; baseline for "since last login"
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  usernameIdx: index("username_idx").on(table.username),
  emailIdx: index("email_idx").on(table.email),
  googleIdIdx: index("google_id_idx").on(table.googleId),
}));

// Follower -> followee relationships between users
export const userFollows = pgTable("user_follows", {
  followerId: integer("follower_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  followeeId: integer("followee_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.followerId, table.followeeId] }),
  followeeIdx: index("user_follows_followee_idx").on(table.followeeId),
  noSelf: check("user_follows_no_self_check", sql`${table.followerId} <> ${table.followeeId}`),
}));

// Civic reputation domains
export const domains = pgTable("domains", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  displayOrder: integer("display_order").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  displayOrderIdx: index("domain_display_order_idx").on(table.displayOrder),
}));

// Aggregated reputation per user and civic domain
export const userDomainReputation = pgTable("user_domain_reputation", {
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  domainId: integer("domain_id").notNull().references(() => domains.id, { onDelete: "cascade" }),
  score: integer("score").default(0).notNull(),
  lastActivityAt: timestamp("last_activity_at").defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.domainId] }),
  userIdx: index("user_domain_reputation_user_idx").on(table.userId),
}));

// Append-only explanation of every reputation change
export const reputationAuditLogs = pgTable("reputation_audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  actorId: integer("actor_id").references(() => users.id, { onDelete: "set null" }),
  domainId: integer("domain_id").notNull().references(() => domains.id, { onDelete: "restrict" }),
  amount: integer("amount").notNull(),
  actionType: text("action_type").notNull(), // IDEA_VOTE | COMMENT_VOTE | CHALLENGE_VOTE
  contentType: text("content_type").notNull(), // idea | comment | challenge
  contentId: integer("content_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userCreatedAtIdx: index("reputation_audit_user_created_idx").on(table.userId, table.createdAt),
  contentIdx: index("reputation_audit_content_idx").on(table.contentType, table.contentId),
  amountNotZero: check("reputation_audit_amount_not_zero", sql`${table.amount} <> 0`),
}));

// Ideas table
export const ideas = pgTable("ideas", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  authorId: integer("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  challengeId: integer("challenge_id").references(() => challenges.id, { onDelete: "cascade" }),
  score: integer("score").default(0).notNull(),
  viewCount: integer("view_count").default(0).notNull(),
  isPinned: boolean("is_pinned").default(false).notNull(),
  isClosed: boolean("is_closed").default(false).notNull(),
  isMarked: boolean("is_marked").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  authorIdx: index("idea_author_idx").on(table.authorId),
  challengeIdx: index("idea_challenge_idx").on(table.challengeId),
  scoreIdx: index("idea_score_idx").on(table.score),
  createdAtIdx: index("idea_created_at_idx").on(table.createdAt),
}));

// Comments table
export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  ideaId: integer("idea_id").references(() => ideas.id, { onDelete: "cascade" }),
  challengeId: integer("challenge_id").references(() => challenges.id, { onDelete: "cascade" }),
  draftId: integer("draft_id").references(() => challengeDrafts.id, { onDelete: "cascade" }),
  authorId: integer("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  parentId: integer("parent_id").references(() => comments.id, { onDelete: "cascade" }),
  score: integer("score").default(0).notNull(),
  isAccepted: boolean("is_accepted").default(false).notNull(),
  isMarked: boolean("is_marked").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  ideaIdx: index("comment_idea_idx").on(table.ideaId),
  challengeIdx: index("comment_challenge_idx").on(table.challengeId),
  draftIdx: index("comment_draft_idx").on(table.draftId),
  authorIdx: index("comment_author_idx").on(table.authorId),
  parentIdx: index("comment_parent_idx").on(table.parentId),
  singleTarget: check("comment_single_target_check", sql`num_nonnulls(${table.ideaId}, ${table.challengeId}, ${table.draftId}) = 1`),
}));

// Idea votes table
export const ideaVotes = pgTable("idea_votes", {
  id: serial("id").primaryKey(),
  ideaId: integer("idea_id").notNull().references(() => ideas.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  value: integer("value").notNull(), // 1 for upvote, -1 for downvote
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  ideaUserUnique: uniqueIndex("idea_user_vote_unique").on(table.ideaId, table.userId),
  valueCheck: check("idea_vote_value_check", sql`${table.value} IN (-1, 1)`),
}));

// Comment votes table
export const commentVotes = pgTable("comment_votes", {
  id: serial("id").primaryKey(),
  commentId: integer("comment_id").notNull().references(() => comments.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  value: integer("value").notNull(), // 1 for upvote, -1 for downvote
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  commentUserUnique: uniqueIndex("comment_user_vote_unique").on(table.commentId, table.userId),
  valueCheck: check("comment_vote_value_check", sql`${table.value} IN (-1, 1)`),
}));

// Idea revisions table
export const ideaRevisions = pgTable("idea_revisions", {
  id: serial("id").primaryKey(),
  ideaId: integer("idea_id").notNull().references(() => ideas.id, { onDelete: "cascade" }),
  editorId: integer("editor_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  content: text("content").notNull(),
  editSummary: text("edit_summary"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  ideaIdx: index("revision_idea_idx").on(table.ideaId),
}));

// Tags table
export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  useCount: integer("use_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Idea tags junction table
export const ideaTags = pgTable("idea_tags", {
  ideaId: integer("idea_id").notNull().references(() => ideas.id, { onDelete: "cascade" }),
  tagId: integer("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  ideaTagUnique: uniqueIndex("idea_tag_unique").on(table.ideaId, table.tagId),
}));

// Challenges table
export const challenges = pgTable("challenges", {
  id: serial("id").primaryKey(),
  creatorId: integer("creator_id").references(() => users.id, { onDelete: "set null" }),
  domainId: integer("domain_id").notNull().references(() => domains.id, { onDelete: "restrict" }),
  category: text("category").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  urgency: text("urgency").notNull(), // 'Low', 'Medium', 'High', 'Critical'
  participantCount: integer("participant_count").default(0).notNull(),
  rewardPool: text("reward_pool"),
  deadline: timestamp("deadline"),
  tags: json("tags").$type<string[]>().default([]).notNull(),
  votes: integer("votes").default(0).notNull(),
  isMarked: boolean("is_marked").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  creatorIdx: index("challenge_creator_idx").on(table.creatorId),
  domainIdx: index("challenge_domain_idx").on(table.domainId),
  categoryIdx: index("challenge_category_idx").on(table.category),
  urgencyIdx: index("challenge_urgency_idx").on(table.urgency),
  votesIdx: index("challenge_votes_idx").on(table.votes),
  deadlineIdx: index("challenge_deadline_idx").on(table.deadline),
}));

// Challenge votes table
export const challengeVotes = pgTable("challenge_votes", {
  id: serial("id").primaryKey(),
  challengeId: integer("challenge_id").notNull().references(() => challenges.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  value: integer("value").notNull(), // 1 for upvote
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  challengeUserUnique: uniqueIndex("challenge_user_vote_unique").on(table.challengeId, table.userId),
  valueCheck: check("challenge_vote_value_check", sql`${table.value} = 1`),
}));

// Which community actions people recommend for a challenge (one vote per user per action)
export const challengeActionVotes = pgTable("challenge_action_votes", {
  challengeId: integer("challenge_id").notNull().references(() => challenges.id, { onDelete: "cascade" }),
  actionKey: text("action_key").notNull(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.challengeId, table.actionKey, table.userId] }),
  actionIdx: index("challenge_action_votes_action_idx").on(table.challengeId, table.actionKey),
}));

// Actions that have been switched on for a challenge. Until a row exists, an action only collects votes.
export const challengeActions = pgTable("challenge_actions", {
  challengeId: integer("challenge_id").notNull().references(() => challenges.id, { onDelete: "cascade" }),
  actionKey: text("action_key").notNull(),
  activatedBy: integer("activated_by").references(() => users.id, { onDelete: "set null" }),
  activatedAt: timestamp("activated_at").defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.challengeId, table.actionKey] }),
}));

// Entries submitted through the action forms (cases, evidence, targets, pledges, tasks, ...).
// `kind` selects the validator in services/action-items.ts; `data` holds the validated fields.
// Child entries (filings, pledges, applications, ...) point at their parent through parent_id.
export const challengeActionItems = pgTable("challenge_action_items", {
  id: serial("id").primaryKey(),
  challengeId: integer("challenge_id").notNull().references(() => challenges.id, { onDelete: "cascade" }),
  actionKey: text("action_key").notNull(),
  kind: text("kind").notNull(),
  parentId: integer("parent_id").references((): AnyPgColumn => challengeActionItems.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  data: json("data").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  listIdx: index("challenge_action_items_list_idx").on(table.challengeId, table.actionKey, table.kind),
  parentIdx: index("challenge_action_items_parent_idx").on(table.parentId),
  userIdx: index("challenge_action_items_user_idx").on(table.userId),
  singletonUnique: uniqueIndex("challenge_action_items_singleton_unique")
    .on(table.challengeId, table.kind, table.userId)
    .where(sql`${table.parentId} IS NULL AND ${table.kind} IN ('lawyer_request', 'bill_draft', 'outreach', 'allocation')`),
  perParentUnique: uniqueIndex("challenge_action_items_per_parent_unique")
    .on(table.challengeId, table.kind, table.userId, table.parentId)
    .where(sql`${table.kind} IN ('pledge', 'application', 'proof', 'resolution_cosponsor')`),
}));

// Reference links users attach to a challenge
export const challengeLinks = pgTable("challenge_links", {
  id: serial("id").primaryKey(),
  challengeId: integer("challenge_id").notNull().references(() => challenges.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  challengeIdx: index("challenge_links_challenge_idx").on(table.challengeId, table.createdAt),
  challengeUrlUnique: uniqueIndex("challenge_links_challenge_url_unique").on(table.challengeId, table.url),
}));

// Challenge drafts table
export const challengeDrafts =  pgTable("challenge_drafts", {
  id: serial("id").primaryKey(),
  challengeId: integer("challenge_id").notNull().references(() => challenges.id, { onDelete: "cascade" }).unique(),
  creatorId: integer("creator_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  challengeIdx: index("draft_challenge_idx").on(table.challengeId),
  creatorIdx: index("draft_creator_idx").on(table.creatorId),
}));

// Support (1) / oppose (-1) votes on a challenge's draft bill, one per user
export const challengeDraftVotes = pgTable("challenge_draft_votes", {
  draftId: integer("draft_id").notNull().references(() => challengeDrafts.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  value: integer("value").notNull(), // 1 support, -1 oppose
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.draftId, table.userId] }),
  valueCheck: check("challenge_draft_vote_value_check", sql`${table.value} IN (-1, 1)`),
}));

// Challenge draft revisions table
export const challengeDraftRevisions = pgTable("challenge_draft_revisions", {
  id: serial("id").primaryKey(),
  draftId: integer("draft_id").notNull().references(() => challengeDrafts.id, { onDelete: "cascade" }),
  editorId: integer("editor_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  draftIdx: index("draft_revision_draft_idx").on(table.draftId),
  createdAtIdx: index("draft_revision_created_at_idx").on(table.createdAt),
}));

// Challenge draft proposals table
export const challengeDraftProposals = pgTable("challenge_draft_proposals", {
  id: serial("id").primaryKey(),
  draftId: integer("draft_id").notNull().references(() => challengeDrafts.id, { onDelete: "cascade" }),
  proposerId: integer("proposer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  status: text("status").default("pending").notNull(), // 'pending', 'accepted', 'rejected'
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  draftIdx: index("proposal_draft_idx").on(table.draftId),
  proposerIdx: index("proposal_proposer_idx").on(table.proposerId),
  statusIdx: index("proposal_status_idx").on(table.status),
}));

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  ideas: many(ideas),
  comments: many(comments),
  ideaVotes: many(ideaVotes),
  commentVotes: many(commentVotes),
  challengeVotes: many(challengeVotes),
  challengeDrafts: many(challengeDrafts),
  challengeDraftRevisions: many(challengeDraftRevisions),
  challengeDraftProposals: many(challengeDraftProposals),
  createdChallenges: many(challenges),
  domainReputation: many(userDomainReputation),
  reputationAuditLogs: many(reputationAuditLogs, { relationName: "reputation_recipient" }),
  reputationActions: many(reputationAuditLogs, { relationName: "reputation_actor" }),
}));

export const domainsRelations = relations(domains, ({ many }) => ({
  challenges: many(challenges),
  userReputation: many(userDomainReputation),
  reputationAuditLogs: many(reputationAuditLogs),
}));

export const userDomainReputationRelations = relations(userDomainReputation, ({ one }) => ({
  user: one(users, {
    fields: [userDomainReputation.userId],
    references: [users.id],
  }),
  domain: one(domains, {
    fields: [userDomainReputation.domainId],
    references: [domains.id],
  }),
}));

export const reputationAuditLogsRelations = relations(reputationAuditLogs, ({ one }) => ({
  user: one(users, {
    fields: [reputationAuditLogs.userId],
    references: [users.id],
    relationName: "reputation_recipient",
  }),
  actor: one(users, {
    fields: [reputationAuditLogs.actorId],
    references: [users.id],
    relationName: "reputation_actor",
  }),
  domain: one(domains, {
    fields: [reputationAuditLogs.domainId],
    references: [domains.id],
  }),
}));

export const ideasRelations = relations(ideas, ({ one, many }) => ({
  author: one(users, {
    fields: [ideas.authorId],
    references: [users.id],
  }),
  challenge: one(challenges, {
    fields: [ideas.challengeId],
    references: [challenges.id],
  }),
  comments: many(comments),
  votes: many(ideaVotes),
  revisions: many(ideaRevisions),
  tags: many(ideaTags),
}));

export const commentsRelations = relations(comments, ({ one, many }) => ({
  idea: one(ideas, {
    fields: [comments.ideaId],
    references: [ideas.id],
  }),
  challenge: one(challenges, {
    fields: [comments.challengeId],
    references: [challenges.id],
  }),
  draft: one(challengeDrafts, {
    fields: [comments.draftId],
    references: [challengeDrafts.id],
  }),
  author: one(users, {
    fields: [comments.authorId],
    references: [users.id],
  }),
  parent: one(comments, {
    fields: [comments.parentId],
    references: [comments.id],
    relationName: "comment_replies",
  }),
  replies: many(comments, {
    relationName: "comment_replies",
  }),
  votes: many(commentVotes),
}));

export const ideaVotesRelations = relations(ideaVotes, ({ one }) => ({
  idea: one(ideas, {
    fields: [ideaVotes.ideaId],
    references: [ideas.id],
  }),
  user: one(users, {
    fields: [ideaVotes.userId],
    references: [users.id],
  }),
}));

export const commentVotesRelations = relations(commentVotes, ({ one }) => ({
  comment: one(comments, {
    fields: [commentVotes.commentId],
    references: [comments.id],
  }),
  user: one(users, {
    fields: [commentVotes.userId],
    references: [users.id],
  }),
}));

export const ideaRevisionsRelations = relations(ideaRevisions, ({ one }) => ({
  idea: one(ideas, {
    fields: [ideaRevisions.ideaId],
    references: [ideas.id],
  }),
  editor: one(users, {
    fields: [ideaRevisions.editorId],
    references: [users.id],
  }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  ideas: many(ideaTags),
}));

export const ideaTagsRelations = relations(ideaTags, ({ one }) => ({
  idea: one(ideas, {
    fields: [ideaTags.ideaId],
    references: [ideas.id],
  }),
  tag: one(tags, {
    fields: [ideaTags.tagId],
    references: [tags.id],
  }),
}));

export const challengesRelations = relations(challenges, ({ one, many }) => ({
  creator: one(users, {
    fields: [challenges.creatorId],
    references: [users.id],
  }),
  domain: one(domains, {
    fields: [challenges.domainId],
    references: [domains.id],
  }),
  votes: many(challengeVotes),
  ideas: many(ideas),
  draft: one(challengeDrafts, {
    fields: [challenges.id],
    references: [challengeDrafts.challengeId],
  }),
}));

export const challengeVotesRelations = relations(challengeVotes, ({ one }) => ({
  challenge: one(challenges, {
    fields: [challengeVotes.challengeId],
    references: [challenges.id],
  }),
  user: one(users, {
    fields: [challengeVotes.userId],
    references: [users.id],
  }),
}));

export const challengeDraftsRelations = relations(challengeDrafts, ({ one, many }) => ({
  challenge: one(challenges, {
    fields: [challengeDrafts.challengeId],
    references: [challenges.id],
  }),
  creator: one(users, {
    fields: [challengeDrafts.creatorId],
    references: [users.id],
  }),
  revisions: many(challengeDraftRevisions),
  proposals: many(challengeDraftProposals),
  comments: many(comments),
}));

export const challengeDraftRevisionsRelations = relations(challengeDraftRevisions, ({ one }) => ({
  draft: one(challengeDrafts, {
    fields: [challengeDraftRevisions.draftId],
    references: [challengeDrafts.id],
  }),
  editor: one(users, {
    fields: [challengeDraftRevisions.editorId],
    references: [users.id],
  }),
}));

export const challengeDraftProposalsRelations = relations(challengeDraftProposals, ({ one }) => ({
  draft: one(challengeDrafts, {
    fields: [challengeDraftProposals.draftId],
    references: [challengeDrafts.id],
  }),
  proposer: one(users, {
    fields: [challengeDraftProposals.proposerId],
    references: [users.id],
  }),
}));

// Content flags table (unified for ideas, comments, challenges)
export const flags = pgTable("flags", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  contentType: text("content_type").notNull(), // 'idea' | 'comment' | 'challenge'
  contentId: integer("content_id").notNull(),
  reason: text("reason").notNull(),
  status: text("status").default("pending").notNull(), // 'pending' | 'reviewed' | 'dismissed' | 'marked'
  reviewedAt: timestamp("reviewed_at"),
  reviewedById: integer("reviewed_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userContentUnique: uniqueIndex("flag_user_content_unique").on(table.userId, table.contentType, table.contentId),
  contentTypeIdx: index("flag_content_type_idx").on(table.contentType, table.contentId),
  statusIdx: index("flag_status_idx").on(table.status),
}));

// Donations confirmed as paid by Stripe. Where it was given is snapshotted from the Checkout Session
// metadata, because some targets (e.g. bounty-board tasks) only exist in the donor's browser.
export const donations = pgTable("donations", {
  id: serial("id").primaryKey(),
  stripeSessionId: text("stripe_session_id").notNull().unique(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  livemode: boolean("livemode").default(false).notNull(),
  amount: integer("amount").notNull(), // smallest currency unit
  currency: text("currency").notNull(),
  donorEmail: text("donor_email"),
  donorName: text("donor_name"),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  challengeId: integer("challenge_id").references(() => challenges.id, { onDelete: "set null" }),
  challengeTitle: text("challenge_title"),
  actionKey: text("action_key"), // 'legal' | 'economic' | 'direct' | 'policy' | 'info'; null = general donation
  targetId: text("target_id"),
  targetTitle: text("target_title"),
  targetLocation: text("target_location"),
  paidAt: timestamp("paid_at").defaultNow().notNull(),
}, (table) => ({
  challengeIdx: index("donations_challenge_idx").on(table.challengeId),
  paidAtIdx: index("donations_paid_at_idx").on(table.paidAt),
}));

export const flagsRelations = relations(flags, ({ one }) => ({
  reporter: one(users, {
    fields: [flags.userId],
    references: [users.id],
  }),
  reviewer: one(users, {
    fields: [flags.reviewedById],
    references: [users.id],
  }),
}));
