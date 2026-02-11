import { pgTable, serial, text, integer, timestamp, boolean, index, uniqueIndex, json } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash"), // Nullable for OAuth users
  displayName: text("display_name"),
  bio: text("bio"),
  avatarUrl: text("avatar_url"), // For Google profile picture
  googleId: text("google_id").unique(), // Google OAuth ID
  authProvider: text("auth_provider").default("local").notNull(), // 'local' or 'google'
  reputation: integer("reputation").default(0).notNull(),
  isAdmin: boolean("is_admin").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  usernameIdx: index("username_idx").on(table.username),
  emailIdx: index("email_idx").on(table.email),
  googleIdIdx: index("google_id_idx").on(table.googleId),
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
  ideaId: integer("idea_id").notNull().references(() => ideas.id, { onDelete: "cascade" }),
  authorId: integer("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  parentId: integer("parent_id").references(() => comments.id, { onDelete: "cascade" }),
  score: integer("score").default(0).notNull(),
  isAccepted: boolean("is_accepted").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  ideaIdx: index("comment_idea_idx").on(table.ideaId),
  authorIdx: index("comment_author_idx").on(table.authorId),
  parentIdx: index("comment_parent_idx").on(table.parentId),
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
  category: text("category").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  urgency: text("urgency").notNull(), // 'Low', 'Medium', 'High', 'Critical'
  participantCount: integer("participant_count").default(0).notNull(),
  rewardPool: text("reward_pool"),
  deadline: timestamp("deadline"),
  tags: json("tags").$type<string[]>().default([]).notNull(),
  votes: integer("votes").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
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
}));

// Challenge drafts table
export const challengeDrafts = pgTable("challenge_drafts", {
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
