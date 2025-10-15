# Environment Configuration Guide

This guide explains how to use different environments in the Earth Forum project.

## Overview

The project supports three environments:
- **Development** - Local development with debugging enabled
- **Staging** - Testing environment that mimics production
- **Production** - Live production environment

## Frontend Environments

### Angular Environment Files

- `frontend/src/app/shared/environments/environment.ts` - Development
- `frontend/src/app/shared/environments/environment.staging.ts` - Staging
- `frontend/src/app/shared/environments/environment.prod.ts` - Production

### Building for Different Environments

```bash
# Development build (default)
cd frontend && npm run build

# Staging build
cd frontend && npm run build:staging

# Production build
cd frontend && npm run build:prod
```

### Serving in Different Modes

```bash
# Development serve (default)
cd frontend && npm start

# Staging serve
cd frontend && npm run start:staging

# Production serve
cd frontend && npm run start:prod
```

## Backend Environments

### Environment Variables

Copy `.env.example` to `.env.local` for local development:

```bash
cp .env.example .env.local
```

### Running Backend in Different Environments

```bash
# Development mode (uses .env.local)
cd backend && npm run dev

# Staging mode (uses .env.staging)
cd backend && npm run start:staging

# Production mode (uses .env.production)
cd backend && npm run start:prod
```

## Docker Environments

### Development (default)
```bash
docker-compose up
```

### Staging
```bash
docker-compose -f docker-compose.staging.yml up
```

### Production
```bash
docker-compose -f docker-compose.prod.yml up
```

## Environment Configuration Details

### Frontend Configuration

Each environment file contains:
- `apiUrl` - Backend API endpoint
- `apiTimeout` - Request timeout duration
- `enableLogging` - Console logging toggle
- `enableDebugMode` - Debug features toggle
- `cacheEnabled` - Response caching toggle
- `features` - Feature flags for different environments

### Backend Configuration

Environment variables include:
- `NODE_ENV` - Environment mode
- `PORT` - Server port
- `DATABASE_URL` - Database connection string
- `LOG_LEVEL` - Logging level (debug, info, warn, error)
- `CORS_ORIGIN` - Allowed CORS origins
- `JWT_SECRET` - JWT signing secret
- `FEATURE_*` - Feature flags

## Security Considerations

1. **Never commit `.env.local`, `.env.staging`, or `.env.production`** to version control
2. **Change default JWT secrets** in production environments
3. **Use strong database passwords** in staging and production
4. **Limit CORS origins** to specific domains in production
5. **Enable proper rate limiting** in production

## Environment-Specific Features

### Development
- Debug logging enabled
- Lenient rate limiting
- All features enabled
- Source maps included
- Hot reload for backend

### Staging
- Production-like configuration
- All features enabled for testing
- Moderate logging
- Optimized builds

### Production
- Minimal logging (warnings/errors only)
- Strict rate limiting
- Optimized and minified builds
- No debug features
- Enhanced security settings

## Deployment Examples

### Local Development Setup
```bash
# Copy environment template
cp .env.example .env.local

# Start backend
cd backend && npm run dev

# Start frontend (in another terminal)
cd frontend && npm start
```

### Production Deployment
```bash
# Build and run with production environment
docker-compose -f docker-compose.prod.yml up --build
```

## Troubleshooting

1. **Environment not loading**: Ensure `.env.*` files are in the project root
2. **CORS errors**: Check `CORS_ORIGIN` settings match your frontend URL
3. **Database connection issues**: Verify `DATABASE_URL` is correct for your environment
4. **Build failures**: Ensure all required environment variables are set

## Adding New Environment Variables

1. Add to `backend/src/config/app.config.ts`
2. Update all `.env.*` files
3. Update this documentation
4. Test in all environments