import { serve } from "bun";
import { readdir } from "fs/promises";
import { join } from "path";
import { config, logConfig } from "./config/app.config";
import { db, testConnection } from "./db";
import { sql } from "drizzle-orm";
import { handleRegister, handleLogin, handleGetProfile, handleUpdateProfile } from "./routes/auth";
import { handleGoogleAuth, handleGetGoogleConfig } from "./routes/google-auth";
import { handleDevLogin, handleGetDevLoginConfig } from "./routes/dev-auth";
import { handleGetDonationConfig, handleCreateDonationSession, handleConfirmDonation, handleStripeWebhook } from "./routes/donations";
import { handleCreateIdea, handleGetIdeas, handleGetIdea, handleUpdateIdea, handleDeleteIdea } from "./routes/ideas";
import { handleCreateComment, handleGetThreadComments, handleUpdateComment, handleDeleteComment, handleAcceptComment } from "./routes/comments";
import { handleVoteIdea, handleVoteComment, handleGetIdeaVote } from "./routes/votes";
import { handleGetChallenges, handleGetChallengeTags, handleCreateChallenge, handleVoteChallenge, handleGetChallenge, handleGetFeaturedChallenge, handleCreateChallengeDraft, handleGetChallengeDraft, handleUpdateChallengeDraft, handleGetChallengeDraftRevisions, handleGetDraftProposals, handleResolveDraftProposal } from "./routes/challenges";
import { handleGetDraftVotes, handleVoteDraft } from "./routes/draft-votes";
import { handleGetChallengeLinks, handleCreateChallengeLink, handleDeleteChallengeLink } from "./routes/challenge-links";
import { handleGetChallengeActions, handleVoteChallengeAction, handleSetChallengeActionActivation } from "./routes/challenge-actions";
import { handleGetActionItems, handleCreateActionItem, handleUpdateActionItem, handleDeleteActionItem } from "./routes/challenge-action-items";
import { handleAdminStats, handleAdminGetUsers, handleAdminUpdateUser, handleAdminGetIdeas, handleAdminDeleteIdea, handleAdminGetComments, handleAdminDeleteComment, handleAdminGetChallenges, handleAdminDeleteChallenge, handleAdminGetFlags, handleAdminResolveFlag, handleAdminMarkContent, handleAdminGetDonations, handleAdminGetActionRecommendations, handleAdminGetApprovals, handleAdminSetApproval } from "./routes/admin";
import { handleCreateFlag, handleDeleteFlag, handleCheckFlag } from "./routes/flags";
import { handleFollowUser, handleGetCivicProfile, handleGetDomains, handleGetFollowingUpdates, handleGetUserActivity, handleGetUserReputation, handleUnfollowUser } from "./routes/profiles";
import { injectSocialMeta } from "./utils/social-meta";

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

      // Civic profile routes
      if (url.pathname === "/api/domains" && req.method === "GET") {
        return handleGetDomains();
      }
      if (url.pathname === "/api/users/me/following-updates" && req.method === "GET") {
        return handleGetFollowingUpdates(req);
      }
      if (url.pathname.match(/^\/api\/users\/[^/]+\/follow$/) && (req.method === "POST" || req.method === "DELETE")) {
        const username = decodeURIComponent(url.pathname.split("/")[3]);
        return req.method === "POST" ? handleFollowUser(req, username) : handleUnfollowUser(req, username);
      }
      if (url.pathname.match(/^\/api\/users\/[^/]+\/profile$/) && req.method === "GET") {
        const username = decodeURIComponent(url.pathname.split("/")[3]);
        return handleGetCivicProfile(req, username);
      }
      if (url.pathname.match(/^\/api\/users\/[^/]+\/activity$/) && req.method === "GET") {
        const username = decodeURIComponent(url.pathname.split("/")[3]);
        return handleGetUserActivity(req, username);
      }
      if (url.pathname.match(/^\/api\/users\/[^/]+\/reputation$/) && req.method === "GET") {
        const username = decodeURIComponent(url.pathname.split("/")[3]);
        return handleGetUserReputation(req, username);
      }
      
      // Google OAuth routes
      if (url.pathname === "/api/auth/google" && req.method === "POST") {
        return handleGoogleAuth(req);
      }
      if (url.pathname === "/api/auth/google/config" && req.method === "GET") {
        return handleGetGoogleConfig(req);
      }

      // Mock-user login for local development (disabled unless DEV_LOGIN=true and NODE_ENV=development)
      if (url.pathname === "/api/auth/dev-login" && req.method === "POST") {
        return handleDevLogin(req);
      }
      if (url.pathname === "/api/auth/dev-login/config" && req.method === "GET") {
        return handleGetDevLoginConfig();
      }
      
      // Donation routes
      if (url.pathname === "/api/donations/config" && req.method === "GET") {
        return handleGetDonationConfig(req);
      }
      if (url.pathname === "/api/donations/checkout-session" && req.method === "POST") {
        return handleCreateDonationSession(req);
      }
      if (url.pathname === "/api/donations/confirm" && req.method === "POST") {
        return handleConfirmDonation(req);
      }
      if (url.pathname === "/api/stripe/webhook" && req.method === "POST") {
        return handleStripeWebhook(req);
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
        return handleGetThreadComments(req, "idea", ideaId);
      }
      if (url.pathname.match(/^\/api\/drafts\/\d+\/comments$/) && req.method === "GET") {
        const draftId = parseInt(url.pathname.split("/")[3]);
        return handleGetThreadComments(req, "draft", draftId);
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
      if (url.pathname === "/api/challenges/tags" && req.method === "GET") {
        return handleGetChallengeTags();
      }
      if (url.pathname === "/api/challenges" && req.method === "POST") {
        return handleCreateChallenge(req);
      }
      if (url.pathname.match(/^\/api\/challenges\/\d+$/) && req.method === "GET") {
        const challengeId = parseInt(url.pathname.split("/")[3]);
        return handleGetChallenge(req, challengeId);
      }
      if (url.pathname.match(/^\/api\/challenges\/\d+\/comments$/) && req.method === "GET") {
        const challengeId = parseInt(url.pathname.split("/")[3]);
        return handleGetThreadComments(req, "challenge", challengeId);
      }
      if (url.pathname === "/api/challenges/vote" && req.method === "POST") {
        return handleVoteChallenge(req);
      }
      
      // Challenge action routes (recommend + activate)
      if (url.pathname.match(/^\/api\/challenges\/\d+\/actions$/) && req.method === "GET") {
        const challengeId = parseInt(url.pathname.split("/")[3]);
        return handleGetChallengeActions(req, challengeId);
      }
      if (url.pathname.match(/^\/api\/challenges\/\d+\/actions\/[a-z]+\/vote$/) && req.method === "POST") {
        const [, , , id, , key] = url.pathname.split("/");
        return handleVoteChallengeAction(req, parseInt(id), key);
      }
      if (url.pathname.match(/^\/api\/challenges\/\d+\/actions\/[a-z]+\/activation$/) && req.method === "PUT") {
        const [, , , id, , key] = url.pathname.split("/");
        return handleSetChallengeActionActivation(req, parseInt(id), key);
      }

      // Action form entries (cases, pledges, tasks, ...)
      if (url.pathname.match(/^\/api\/challenges\/\d+\/action-items$/) && req.method === "GET") {
        return handleGetActionItems(req, parseInt(url.pathname.split("/")[3]));
      }
      if (url.pathname.match(/^\/api\/challenges\/\d+\/action-items$/) && req.method === "POST") {
        return handleCreateActionItem(req, parseInt(url.pathname.split("/")[3]));
      }
      if (url.pathname.match(/^\/api\/challenges\/\d+\/action-items\/\d+$/) && req.method === "PUT") {
        const [, , , id, , itemId] = url.pathname.split("/");
        return handleUpdateActionItem(req, parseInt(id), parseInt(itemId));
      }
      if (url.pathname.match(/^\/api\/challenges\/\d+\/action-items\/\d+$/) && req.method === "DELETE") {
        const [, , , id, , itemId] = url.pathname.split("/");
        return handleDeleteActionItem(req, parseInt(id), parseInt(itemId));
      }

      // Challenge link routes
      if (url.pathname.match(/^\/api\/challenges\/\d+\/links$/) && req.method === "GET") {
        return handleGetChallengeLinks(req, parseInt(url.pathname.split("/")[3]));
      }
      if (url.pathname.match(/^\/api\/challenges\/\d+\/links$/) && req.method === "POST") {
        return handleCreateChallengeLink(req, parseInt(url.pathname.split("/")[3]));
      }
      if (url.pathname.match(/^\/api\/challenges\/\d+\/links\/\d+$/) && req.method === "DELETE") {
        const [, , , id, , linkId] = url.pathname.split("/");
        return handleDeleteChallengeLink(req, parseInt(id), parseInt(linkId));
      }

      // Challenge draft routes
      if (url.pathname.match(/^\/api\/challenges\/\d+\/draft$/) && req.method === "POST") {
        const challengeId = parseInt(url.pathname.split("/")[3]);
        return handleCreateChallengeDraft(req, challengeId);
      }
      if (url.pathname.match(/^\/api\/challenges\/\d+\/draft$/) && req.method === "GET") {
        const challengeId = parseInt(url.pathname.split("/")[3]);
        return handleGetChallengeDraft(req, challengeId);
      }
      if (url.pathname.match(/^\/api\/challenges\/\d+\/draft$/) && req.method === "PUT") {
        const challengeId = parseInt(url.pathname.split("/")[3]);
        return handleUpdateChallengeDraft(req, challengeId);
      }
      if (url.pathname.match(/^\/api\/challenges\/\d+\/draft\/votes$/) && req.method === "GET") {
        const challengeId = parseInt(url.pathname.split("/")[3]);
        return handleGetDraftVotes(req, challengeId);
      }
      if (url.pathname.match(/^\/api\/challenges\/\d+\/draft\/votes$/) && req.method === "POST") {
        const challengeId = parseInt(url.pathname.split("/")[3]);
        return handleVoteDraft(req, challengeId);
      }
      if (url.pathname.match(/^\/api\/challenges\/\d+\/draft\/revisions$/) && req.method === "GET") {
        const challengeId = parseInt(url.pathname.split("/")[3]);
        return handleGetChallengeDraftRevisions(req, challengeId);
      }
      if (url.pathname.match(/^\/api\/challenges\/\d+\/draft\/proposals$/) && req.method === "GET") {
        const challengeId = parseInt(url.pathname.split("/")[3]);
        return handleGetDraftProposals(req, challengeId);
      }
      if (url.pathname.match(/^\/api\/challenges\/\d+\/draft\/proposals\/\d+\/resolve$/) && req.method === "POST") {
        const challengeId = parseInt(url.pathname.split("/")[3]);
        const proposalId = parseInt(url.pathname.split("/")[6]);
        return handleResolveDraftProposal(req, challengeId, proposalId);
      }
      
      // Add more API routes here
      // Admin routes
      if (url.pathname === "/api/admin/stats" && req.method === "GET") {
        return handleAdminStats(req);
      }
      if (url.pathname === "/api/admin/users" && req.method === "GET") {
        return handleAdminGetUsers(req);
      }
      if (url.pathname.match(/^\/api\/admin\/users\/\d+$/) && req.method === "PATCH") {
        const userId = parseInt(url.pathname.split("/")[4]);
        return handleAdminUpdateUser(req, userId);
      }
      if (url.pathname === "/api/admin/ideas" && req.method === "GET") {
        return handleAdminGetIdeas(req);
      }
      if (url.pathname.match(/^\/api\/admin\/ideas\/\d+$/) && req.method === "DELETE") {
        const ideaId = parseInt(url.pathname.split("/")[4]);
        return handleAdminDeleteIdea(req, ideaId);
      }
      if (url.pathname === "/api/admin/comments" && req.method === "GET") {
        return handleAdminGetComments(req);
      }
      if (url.pathname.match(/^\/api\/admin\/comments\/\d+$/) && req.method === "DELETE") {
        const commentId = parseInt(url.pathname.split("/")[4]);
        return handleAdminDeleteComment(req, commentId);
      }
      if (url.pathname === "/api/admin/challenges" && req.method === "GET") {
        return handleAdminGetChallenges(req);
      }
      if (url.pathname.match(/^\/api\/admin\/challenges\/\d+$/) && req.method === "DELETE") {
        const challengeId = parseInt(url.pathname.split("/")[4]);
        return handleAdminDeleteChallenge(req, challengeId);
      }
      if (url.pathname === "/api/admin/flags" && req.method === "GET") {
        return handleAdminGetFlags(req);
      }
      if (url.pathname === "/api/admin/approvals" && req.method === "GET") {
        return handleAdminGetApprovals(req);
      }
      if (url.pathname.match(/^\/api\/admin\/approvals\/\d+$/) && req.method === "PUT") {
        return handleAdminSetApproval(req, parseInt(url.pathname.split("/")[4]));
      }
      if (url.pathname === "/api/admin/action-recommendations" && req.method === "GET") {
        return handleAdminGetActionRecommendations(req);
      }
      if (url.pathname === "/api/admin/donations" && req.method === "GET") {
        return handleAdminGetDonations(req);
      }
      if (url.pathname.match(/^\/api\/admin\/flags\/\d+\/mark$/) && req.method === "PATCH") {
        const flagId = parseInt(url.pathname.split("/")[4]);
        return handleAdminMarkContent(req, flagId);
      }
      if (url.pathname.match(/^\/api\/admin\/flags\/\d+$/) && req.method === "PATCH") {
        const flagId = parseInt(url.pathname.split("/")[4]);
        return handleAdminResolveFlag(req, flagId);
      }

      // Flag routes
      if (url.pathname === "/api/flags" && req.method === "POST") {
        return handleCreateFlag(req);
      }
      if (url.pathname === "/api/flags/me" && req.method === "GET") {
        return handleCheckFlag(req);
      }
      if (url.pathname.match(/^\/api\/flags\/[a-z]+\/\d+$/) && req.method === "DELETE") {
        const parts = url.pathname.split("/");
        const contentType = parts[3];
        const contentId = parseInt(parts[4]);
        return handleDeleteFlag(req, contentType, contentId);
      }

      return new Response(JSON.stringify({ error: "API endpoint not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    // Serve static files
    try {
      const isIndexRequest = url.pathname === "/" || url.pathname === "/index.html";
      const filePath = join(publicDir, isIndexRequest ? "index.html" : url.pathname);
      const file = Bun.file(filePath);
      
      if (await file.exists()) {
        if (isIndexRequest) {
          return serveIndexWithMeta(file, req, url);
        }
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
        return serveIndexWithMeta(indexFile, req, url);
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

// Serves index.html with per-page social preview tags
async function serveIndexWithMeta(file: ReturnType<typeof Bun.file>, req: Request, url: URL): Promise<Response> {
  const html = await injectSocialMeta(await file.text(), req, url);
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}

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
