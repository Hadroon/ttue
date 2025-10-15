import { serve } from "bun";
import { readdir } from "fs/promises";
import { join } from "path";
import { config, logConfig } from "./config/app.config";

// Log configuration on startup
logConfig();

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
        return new Response(JSON.stringify({ 
          status: "ok", 
          timestamp: new Date().toISOString(),
          service: "bun-backend"
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
