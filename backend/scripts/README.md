# Database Reset Scripts

This directory contains scripts to completely reset the Earth Forum database.

## Available Scripts

### PowerShell (Windows)
```powershell
cd backend
bun run db:reset
```

### Bash (Linux/Mac)
```bash
cd backend
bun run db:reset:bash
```

## What the reset does

1. **Stops all Docker containers** via `docker-compose down`
2. **Removes the database volume** (`earth-forum-pgdata`) - this deletes all data
3. **Restarts PostgreSQL** container
4. **Waits for database** to be ready (with health checks)
5. **Runs migrations** to recreate all tables with latest schema
6. **Seeds initial data** including:
   - 1 seed user (`seed_user@earthforum.com`)
   - 3 challenges (Climate Adaptation, Digital Equity, Affordable Housing)
   - Sample ideas/posts and comments

## Safety Features

Both scripts include safety checks to prevent accidental production data loss:

- ✅ Verifies `.env.local` file exists
- ✅ Checks `NODE_ENV` is not set to `production` or `staging`
- ✅ Requires manual confirmation (`yes`) before proceeding
- ✅ Provides clear feedback at each step

## Manual Reset (Alternative)

If you prefer to run commands manually:

```powershell
# 1. Stop containers and remove volume
docker-compose down
docker volume rm earth-forum-pgdata

# 2. Start PostgreSQL
docker-compose up -d postgres

# 3. Wait for it to be ready (check with)
docker exec earth-forum-postgres pg_isready -U postgres

# 4. Run migrations
cd backend
bun run db:migrate

# 5. Seed data
bun run db:seed
```

## Troubleshooting

**Script won't run on Windows:**
```powershell
# Enable script execution
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**Bash script permission denied:**
```bash
chmod +x backend/scripts/reset-db.sh
```

**Volume removal fails:**
- Make sure all containers are stopped: `docker-compose down`
- Check if volume exists: `docker volume ls | grep earth-forum`
- Force remove: `docker volume rm -f earth-forum-pgdata`
