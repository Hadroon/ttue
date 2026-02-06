#!/bin/bash
# Database Reset Script for Earth Forum (Bash version for Linux/Mac)
# This script completely resets the database by:
# 1. Stopping Docker containers
# 2. Removing the database volume
# 3. Restarting PostgreSQL
# 4. Running migrations
# 5. Seeding initial data

set -e  # Exit on error

echo "=================================="
echo "Earth Forum Database Reset Script"
echo "=================================="
echo ""

# Change to project root directory (two levels up from scripts/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../.."

# Safety check: Prevent running in production/staging
ENV_FILE=".env.local"
if [ ! -f "$ENV_FILE" ]; then
    echo "ERROR: .env.local file not found!"
    echo "This script should only be run in local development."
    exit 1
fi

# Check NODE_ENV in .env.local
if grep -qE 'NODE_ENV\s*=\s*(production|staging)' "$ENV_FILE"; then
    NODE_ENV=$(grep -oP 'NODE_ENV\s*=\s*\K(production|staging)' "$ENV_FILE" || echo "")
    echo "ERROR: NODE_ENV is set to '$NODE_ENV' in .env.local!"
    echo "This script should only be run with NODE_ENV=development."
    echo "Aborting to prevent accidental data loss."
    exit 1
fi

# Confirm action
echo "WARNING: This will DELETE ALL DATA in your local database!"
echo "Volume to be removed: earth-forum-pgdata"
echo ""
read -p "Are you sure you want to continue? (type 'yes' to confirm): " confirmation
if [ "$confirmation" != "yes" ]; then
    echo "Reset cancelled."
    exit 0
fi

echo ""
echo "[1/6] Stopping Docker containers..."
docker-compose down

echo "[2/6] Removing database volume..."
docker volume rm earth-forum-pgdata || echo "WARNING: Volume might not exist or already removed"

echo "[3/6] Starting PostgreSQL container..."
docker-compose up -d postgres

echo "[4/6] Waiting for PostgreSQL to be ready..."
max_attempts=30
attempt=0
ready=false

while [ "$ready" = false ] && [ $attempt -lt $max_attempts ]; do
    attempt=$((attempt + 1))
    echo -n "  Attempt $attempt/$max_attempts..."
    
    if docker exec earth-forum-postgres pg_isready -U postgres > /dev/null 2>&1; then
        ready=true
        echo " Ready!"
    else
        echo " Not ready yet"
        sleep 2
    fi
done

if [ "$ready" = false ]; then
    echo "ERROR: PostgreSQL failed to start within timeout"
    exit 1
fi

echo "[5/6] Running database migrations..."
cd backend
bun run db:migrate

echo "[6/6] Seeding database with initial data..."
bun run db:seed

cd ..

echo ""
echo "================================"
echo "✅ Database reset complete!"
echo "================================"
echo ""
echo "Next steps:"
echo "  1. Start all services: docker-compose up -d"
echo "  2. Or start backend dev: cd backend && bun run dev"
echo ""
echo "Database credentials:"
echo "  Host: localhost:5432"
echo "  Database: ttue_dev"
echo "  User: postgres"
echo "  Password: postgres"
echo ""
echo "Seeded data includes:"
echo "  - 1 seed user (seed_user@earthforum.com)"
echo "  - 3 challenges with ideas and comments"
echo ""
