import { db } from "../db";
import { posts, users, postVotes, postTags, tags } from "../db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { authenticate, optionalAuth } from "../middleware/auth";

// Create new post
export async function handleCreatePost(req: Request): Promise<Response> {
  const authResult = await authenticate(req);
  if (authResult instanceof Response) return authResult;

  try {
    const { title, content, tagNames } = await req.json();

    // Validate input
    if (!title || !content) {
      return new Response(
        JSON.stringify({ error: "Title and content are required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Create post
    const [newPost] = await db
      .insert(posts)
      .values({
        title,
        content,
        authorId: authResult.user.userId,
      })
      .returning();

    // Handle tags if provided
    if (tagNames && Array.isArray(tagNames) && tagNames.length > 0) {
      for (const tagName of tagNames) {
        // Find or create tag
        let [tag] = await db
          .select()
          .from(tags)
          .where(eq(tags.name, tagName.toLowerCase()))
          .limit(1);

        if (!tag) {
          [tag] = await db
            .insert(tags)
            .values({ name: tagName.toLowerCase() })
            .returning();
        }

        // Link post to tag
        await db.insert(postTags).values({
          postId: newPost.id,
          tagId: tag.id,
        });

        // Increment tag use count
        await db
          .update(tags)
          .set({ useCount: sql`${tags.useCount} + 1` })
          .where(eq(tags.id, tag.id));
      }
    }

    return new Response(
      JSON.stringify({ post: newPost }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Create post error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to create post" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Get all posts
export async function handleGetPosts(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const allPosts = await db
      .select({
        id: posts.id,
        title: posts.title,
        content: posts.content,
        score: posts.score,
        viewCount: posts.viewCount,
        isPinned: posts.isPinned,
        isClosed: posts.isClosed,
        createdAt: posts.createdAt,
        updatedAt: posts.updatedAt,
        author: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          reputation: users.reputation,
        },
      })
      .from(posts)
      .leftJoin(users, eq(posts.authorId, users.id))
      .orderBy(desc(posts.isPinned), desc(posts.createdAt))
      .limit(limit)
      .offset(offset);

    return new Response(
      JSON.stringify({ posts: allPosts, limit, offset }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Get posts error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to get posts" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Get single post by ID
export async function handleGetPost(req: Request, postId: number): Promise<Response> {
  try {
    const [post] = await db
      .select({
        id: posts.id,
        title: posts.title,
        content: posts.content,
        score: posts.score,
        viewCount: posts.viewCount,
        isPinned: posts.isPinned,
        isClosed: posts.isClosed,
        createdAt: posts.createdAt,
        updatedAt: posts.updatedAt,
        author: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          reputation: users.reputation,
        },
      })
      .from(posts)
      .leftJoin(users, eq(posts.authorId, users.id))
      .where(eq(posts.id, postId))
      .limit(1);

    if (!post) {
      return new Response(
        JSON.stringify({ error: "Post not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Increment view count
    await db
      .update(posts)
      .set({ viewCount: sql`${posts.viewCount} + 1` })
      .where(eq(posts.id, postId));

    return new Response(
      JSON.stringify({ post }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Get post error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to get post" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Update post
export async function handleUpdatePost(req: Request, postId: number): Promise<Response> {
  const authResult = await authenticate(req);
  if (authResult instanceof Response) return authResult;

  try {
    const { title, content } = await req.json();

    // Check if user owns the post
    const [post] = await db
      .select()
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1);

    if (!post) {
      return new Response(
        JSON.stringify({ error: "Post not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    if (post.authorId !== authResult.user.userId) {
      return new Response(
        JSON.stringify({ error: "You don't have permission to edit this post" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // Update post
    const [updatedPost] = await db
      .update(posts)
      .set({
        title: title || undefined,
        content: content || undefined,
        updatedAt: new Date(),
      })
      .where(eq(posts.id, postId))
      .returning();

    return new Response(
      JSON.stringify({ post: updatedPost }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Update post error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to update post" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// Delete post
export async function handleDeletePost(req: Request, postId: number): Promise<Response> {
  const authResult = await authenticate(req);
  if (authResult instanceof Response) return authResult;

  try {
    // Check if user owns the post
    const [post] = await db
      .select()
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1);

    if (!post) {
      return new Response(
        JSON.stringify({ error: "Post not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    if (post.authorId !== authResult.user.userId) {
      return new Response(
        JSON.stringify({ error: "You don't have permission to delete this post" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // Delete post (cascades to comments, votes, etc.)
    await db.delete(posts).where(eq(posts.id, postId));

    return new Response(
      JSON.stringify({ message: "Post deleted successfully" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Delete post error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to delete post" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
