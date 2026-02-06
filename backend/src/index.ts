import { serve } from "bun";
import { readdir } from "fs/promises";
import { join } from "path";
import { config, logConfig } from "./config/app.config";
import { db, testConnection } from "./db";
import { sql } from "drizzle-orm";
import { handleRegister, handleLogin, handleGetProfile, handleUpdateProfile } from "./routes/auth";
import { handleGoogleAuth, handleGetGoogleConfig } from "./routes/google-auth";
import { handleCreateIdea, handleGetIdeas, handleGetIdea, handleUpdateIdea, handleDeleteIdea } from "./routes/ideas";
import { handleCreateComment, handleGetComments, handleUpdateComment, handleDeleteComment, handleAcceptComment } from "./routes/comments";
import { handleVoteIdea, handleVoteComment, handleGetIdeaVote } from "./routes/votes";
import { handleGetChallenges, handleCreateChallenge, handleVoteChallenge, handleGetChallenge, handleGetFeaturedChallenge } from "./routes/challenges";

// Log configuration on startup
logConfig();

// Test database connection
await testConnection();

const publicDir = join(process.cwd(), "public");

// Check if public directory exists
try {
  await readdir(publicDir);
  console.log(`📁 Static files directory found: ${publicDir}`);
} catch {
  console.log(`⚠️  Static files directory not found: ${publicDir}`);
}

serve({
  port: config.port,
  async fetch(req) {
    const url = new URL(req.url);
    
    // API routes
    if (url.pathname.startsWith("/api")) {
      if (url.pathname === "/api/health") {
        let dbStatus = "unknown";
        try {
          await db.execute(sql`SELECT 1`);
          dbStatus = "connected";
        } catch {
          dbStatus = "disconnected";
        }
        
        return new Response(JSON.stringify({ 
          status: "ok", 
          timestamp: new Date().toISOString(),
          service: "bun-backend",
          database: dbStatus
        }), {
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.pathname === "/api/welcome" && req.method === "POST") {
        try {
          console.log("Received /api/welcome request");
          const { password } = await req.json();
          if (password === "csigga") {
            return new Response(JSON.stringify({ 
              success: true,
              data: true,
              message: "Welcome! Access granted."
            }), {
              headers: { "Content-Type": "application/json" },
            });
          } else {
            return new Response(JSON.stringify({ 
              success: false,
              data: false,
              error: "Invalid password"
            }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }
        } catch (error) {
          return new Response(JSON.stringify({ 
            success: false,
            data: false,
            error: "Invalid request format"
          }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
      }
      
      // Auth routes
      if (url.pathname === "/api/auth/register" && req.method === "POST") {
        return handleRegister(req);
      }
      if (url.pathname === "/api/auth/login" && req.method === "POST") {
        return handleLogin(req);
      }
      if (url.pathname === "/api/auth/profile" && req.method === "GET") {
        return handleGetProfile(req);
      }
      if (url.pathname === "/api/auth/profile" && req.method === "PUT") {
        return handleUpdateProfile(req);
      }
      
      // Google OAuth routes
      if (url.pathname === "/api/auth/google" && req.method === "POST") {
        return handleGoogleAuth(req);
      }
      if (url.pathname === "/api/auth/google/config" && req.method === "GET") {
        return handleGetGoogleConfig(req);
      }
      
      // Ideas routes
      if (url.pathname === "/api/ideas" && req.method === "GET") {
        return handleGetIdeas(req);
      }
      if (url.pathname === "/api/ideas" && req.method === "POST") {
        return handleCreateIdea(req);
      }
      if (url.pathname.match(/^\/api\/ideas\/\d+$/) && req.method === "GET") {
        const ideaId = parseInt(url.pathname.split("/")[3]);
        return handleGetIdea(req, ideaId);
      }
      if (url.pathname.match(/^\/api\/ideas\/\d+$/) && req.method === "PUT") {
        const ideaId = parseInt(url.pathname.split("/")[3]);
        return handleUpdateIdea(req, ideaId);
      }
      if (url.pathname.match(/^\/api\/ideas\/\d+$/) && req.method === "DELETE") {
        const ideaId = parseInt(url.pathname.split("/")[3]);
        return handleDeleteIdea(req, ideaId);
      }
      
      // Comments routes
      if (url.pathname === "/api/comments" && req.method === "POST") {
        return handleCreateComment(req);
      }
      if (url.pathname.match(/^\/api\/ideas\/\d+\/comments$/) && req.method === "GET") {
        const ideaId = parseInt(url.pathname.split("/")[3]);
        return handleGetComments(req, ideaId);
      }
      if (url.pathname.match(/^\/api\/comments\/\d+$/) && req.method === "PUT") {
        const commentId = parseInt(url.pathname.split("/")[3]);
        return handleUpdateComment(req, commentId);
      }
      if (url.pathname.match(/^\/api\/comments\/\d+$/) && req.method === "DELETE") {
        const commentId = parseInt(url.pathname.split("/")[3]);
        return handleDeleteComment(req, commentId);
      }
      if (url.pathname.match(/^\/api\/comments\/\d+\/accept$/) && req.method === "POST") {
        const commentId = parseInt(url.pathname.split("/")[3]);
        return handleAcceptComment(req, commentId);
      }
      
      // Voting routes
      if (url.pathname.match(/^\/api\/ideas\/\d+\/vote$/) && req.method === "POST") {
        const ideaId = parseInt(url.pathname.split("/")[3]);
        return handleVoteIdea(req, ideaId);
      }
      if (url.pathname.match(/^\/api\/ideas\/\d+\/vote$/) && req.method === "GET") {
        const ideaId = parseInt(url.pathname.split("/")[3]);
        return handleGetIdeaVote(req, ideaId);
      }
      if (url.pathname.match(/^\/api\/comments\/\d+\/vote$/) && req.method === "POST") {
        const commentId = parseInt(url.pathname.split("/")[3]);
        return handleVoteComment(req, commentId);
      }
      
      // Challenges routes
      if (url.pathname === "/api/challenges" && req.method === "GET") {
        return handleGetChallenges(req);
      }
      if (url.pathname === "/api/challenges/featured" && req.method === "GET") {
        return handleGetFeaturedChallenge(req);
      }
      if (url.pathname === "/api/challenges" && req.method === "POST") {
        return handleCreateChallenge(req);
      }
      if (url.pathname.match(/^\/api\/challenges\/\d+$/) && req.method === "GET") {
        const challengeId = parseInt(url.pathname.split("/")[3]);
        return handleGetChallenge(req, challengeId);
      }
      if (url.pathname === "/api/challenges/vote" && req.method === "POST") {
        return handleVoteChallenge(req);
      }
      
      // Add more API routes here
      return new Response(JSON.stringify({ error: "API endpoint not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    // Serve static files
    try {
      const filePath = join(publicDir, url.pathname === "/" ? "index.html" : url.pathname);
      const file = Bun.file(filePath);
      
      if (await file.exists()) {
        return new Response(file, {
          headers: {
            "Content-Type": getContentType(filePath),
            "Cache-Control": url.pathname.includes("/assets/") ? "public, max-age=31536000" : "no-cache",
          },
        });
      }
    } catch (error) {
      console.error("Error serving static file:", error);
    }
    
    // Fallback to index.html for Angular routing (SPA)
    try {
      const indexFile = Bun.file(join(publicDir, "index.html"));
      if (await indexFile.exists()) {
        return new Response(indexFile, {
          headers: {
            "Content-Type": "text/html",
            "Cache-Control": "no-cache",
          },
        });
      }
    } catch (error) {
      console.error("Error serving index.html:", error);
    }
    
    // Final fallback
    return new Response("404 - Page not found", { 
      status: 404,
      headers: { "Content-Type": "text/plain" },
    });
  },
});

// Helper function to get content type
function getContentType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const contentTypes: Record<string, string> = {
    'html': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'json': 'application/json',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon',
    'woff': 'font/woff',
    'woff2': 'font/woff2',
    'ttf': 'font/ttf',
    'eot': 'application/vnd.ms-fontobject',
  };
  return contentTypes[ext || ''] || 'application/octet-stream';
}

console.log(`🚀 Bun server with Angular frontend listening on http://localhost:${config.port}`);
console.log(`📡 API endpoints available at http://localhost:${config.port}/api/*`);
console.log(`🌐 Frontend available at http://localhost:${config.port}/`);
