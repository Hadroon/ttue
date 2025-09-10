# Earth Forum - Copilot Instructions

## Architecture Overview
This is a forum application with **Bun-powered backend** serving **Angular 20 frontend**. The backend acts as both API server (`/api/*`) and static file server for the Angular SPA.

### Key Components
- **Backend**: Bun runtime with TypeScript, serves at port 3000
- **Frontend**: Angular 20 with SSR support, proxies API calls via `proxy.conf.json`
- **Database**: PostgreSQL with Drizzle ORM schema in `backend/src/db/schema.ts`
- **Deployment**: Multi-stage Docker build serving Angular from Bun server

## Development Workflows

### Local Development
```bash
# Backend only
cd backend && bun dev  # Hot reload with --watch

# Frontend only  
cd frontend && npm start  # Proxies /api/* to localhost:3000

# Full stack
docker-compose up  # Backend serves built Angular from /public
```

### Database Operations
- Schema: `backend/src/db/schema.ts` (Drizzle ORM with relations)
- Migrations: Generated in `backend/src/db/migrations/` 
- Connection: Uses `DATABASE_URL` env var, defaults to `postgresql://localhost:5432/ttue_dev`

## Project-Specific Patterns

### Backend Architecture (`backend/src/index.ts`)
- **Single Bun server** handles both API routes and static files
- API routes under `/api/*`, all others serve Angular SPA
- Fallback to `index.html` for Angular routing (SPA behavior)
- Content-Type detection via file extensions
- Cache headers: long-term for `/assets/*`, no-cache for others

### Frontend Integration
- **Proxy Configuration**: `frontend/src/proxy.conf.json` routes `/api/*` to backend
- **REST Service**: `frontend/src/app/shared/services/rest-api.service.ts` (needs baseUrl update from example.com)
- **SSR Ready**: Angular 20 with server-side rendering configured

### Database Schema Highlights
Forum-specific entities in `backend/src/db/schema.ts`:
- Users with reputation system
- Posts with vote scoring and view counts  
- Nested comments with parent/child relationships
- Post revisions with diff tracking
- Unique constraints on user votes (prevents duplicate voting)

### Docker Strategy
Multi-stage build in `backend/Dockerfile`:
1. Node.js stage builds Angular frontend
2. Bun stage copies built frontend to `/public` and runs backend
3. Single container serves both frontend and API

## Critical Developer Notes

- **API Development**: Add routes in `backend/src/index.ts` under the `/api` pathname check
- **Frontend-Backend Communication**: Update `rest-api.service.ts` baseUrl for production
- **Database Changes**: Update schema in `schema.ts`, generate migrations with Drizzle
- **Hot Reload**: Backend source volume-mounted in docker-compose for development
- **Production Build**: Frontend gets compiled into backend's public directory