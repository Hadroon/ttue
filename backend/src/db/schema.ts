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

// Posts table
export const posts = pgTable("posts", {
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
  authorIdx: index("post_author_idx").on(table.authorId),
  challengeIdx: index("post_challenge_idx").on(table.challengeId),
  scoreIdx: index("post_score_idx").on(table.score),
  createdAtIdx: index("post_created_at_idx").on(table.createdAt),
}));

// Comments table
export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  postId: integer("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  authorId: integer("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  parentId: integer("parent_id").references(() => comments.id, { onDelete: "cascade" }),
  score: integer("score").default(0).notNull(),
  isAccepted: boolean("is_accepted").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  postIdx: index("comment_post_idx").on(table.postId),
  authorIdx: index("comment_author_idx").on(table.authorId),
  parentIdx: index("comment_parent_idx").on(table.parentId),
}));

// Post votes table
export const postVotes = pgTable("post_votes", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  value: integer("value").notNull(), // 1 for upvote, -1 for downvote
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  postUserUnique: uniqueIndex("post_user_vote_unique").on(table.postId, table.userId),
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

// Post revisions table
export const postRevisions = pgTable("post_revisions", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  editorId: integer("editor_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  content: text("content").notNull(),
  editSummary: text("edit_summary"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  postIdx: index("revision_post_idx").on(table.postId),
}));

// Tags table
export const tags = pgTable("tags", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  useCount: integer("use_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Post tags junction table
export const postTags = pgTable("post_tags", {
  postId: integer("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  tagId: integer("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  postTagUnique: uniqueIndex("post_tag_unique").on(table.postId, table.tagId),
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

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
  comments: many(comments),
  postVotes: many(postVotes),
  commentVotes: many(commentVotes),
  challengeVotes: many(challengeVotes),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
  challenge: one(challenges, {
    fields: [posts.challengeId],
    references: [challenges.id],
  }),
  comments: many(comments),
  votes: many(postVotes),
  revisions: many(postRevisions),
  tags: many(postTags),
}));

export const commentsRelations = relations(comments, ({ one, many }) => ({
  post: one(posts, {
    fields: [comments.postId],
    references: [posts.id],
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

export const postVotesRelations = relations(postVotes, ({ one }) => ({
  post: one(posts, {
    fields: [postVotes.postId],
    references: [posts.id],
  }),
  user: one(users, {
    fields: [postVotes.userId],
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

export const postRevisionsRelations = relations(postRevisions, ({ one }) => ({
  post: one(posts, {
    fields: [postRevisions.postId],
    references: [posts.id],
  }),
  editor: one(users, {
    fields: [postRevisions.editorId],
    references: [users.id],
  }),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  posts: many(postTags),
}));

export const postTagsRelations = relations(postTags, ({ one }) => ({
  post: one(posts, {
    fields: [postTags.postId],
    references: [posts.id],
  }),
  tag: one(tags, {
    fields: [postTags.tagId],
    references: [tags.id],
  }),
}));

export const challengesRelations = relations(challenges, ({ many }) => ({
  votes: many(challengeVotes),
  ideas: many(posts),
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
