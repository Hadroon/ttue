# Database Reset Script for Earth Forum
# This script completely resets the database by:
# 1. Stopping Docker containers
# 2. Removing the database volume
# 3. Restarting PostgreSQL
# 4. Running migrations
# 5. Seeding initial data

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Earth Forum Database Reset Script" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Change to project root directory (two levels up from scripts/)
$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $projectRoot

# Safety check: Prevent running in production/staging
$envFile = ".env.local"
if (-Not (Test-Path $envFile)) {
    Write-Host "ERROR: .env.local file not found!" -ForegroundColor Red
    Write-Host "This script should only be run in local development." -ForegroundColor Red
    exit 1
}

# Check NODE_ENV in .env.local
$envContent = Get-Content $envFile -Raw
if ($envContent -match 'NODE_ENV\s*=\s*(production|staging)') {
    Write-Host "ERROR: NODE_ENV is set to '$($matches[1])' in .env.local!" -ForegroundColor Red
    Write-Host "This script should only be run with NODE_ENV=development." -ForegroundColor Red
    Write-Host "Aborting to prevent accidental data loss." -ForegroundColor Red
    exit 1
}

# Confirm action
Write-Host "WARNING: This will DELETE ALL DATA in your local database!" -ForegroundColor Yellow
Write-Host "Volume to be removed: earth-forum-pgdata" -ForegroundColor Yellow
Write-Host ""
$confirmation = Read-Host "Are you sure you want to continue? (type 'yes' to confirm)"
if ($confirmation -ne "yes") {
    Write-Host "Reset cancelled." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "[1/6] Stopping Docker containers..." -ForegroundColor Green
docker-compose down
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to stop containers" -ForegroundColor Red
    exit 1
}

Write-Host "[2/6] Removing database volume..." -ForegroundColor Green
docker volume rm earth-forum-pgdata
if ($LASTEXITCODE -ne 0) {
    Write-Host "WARNING: Volume might not exist or already removed" -ForegroundColor Yellow
}

Write-Host "[3/6] Starting PostgreSQL container..." -ForegroundColor Green
docker-compose up -d postgres
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to start PostgreSQL" -ForegroundColor Red
    exit 1
}

Write-Host "[4/6] Waiting for PostgreSQL to be ready..." -ForegroundColor Green
$maxAttempts = 30
$attempt = 0
$ready = $false

while (-Not $ready -and $attempt -lt $maxAttempts) {
    $attempt++
    Write-Host "  Attempt $attempt/$maxAttempts..." -NoNewline
    
    $healthCheck = docker exec earth-forum-postgres pg_isready -U postgres 2>$null
    if ($LASTEXITCODE -eq 0) {
        $ready = $true
        Write-Host " Ready!" -ForegroundColor Green
    } else {
        Write-Host " Not ready yet" -ForegroundColor Yellow
        Start-Sleep -Seconds 2
    }
}

if (-Not $ready) {
    Write-Host "ERROR: PostgreSQL failed to start within timeout" -ForegroundColor Red
    exit 1
}

Write-Host "[5/6] Running database migrations..." -ForegroundColor Green
Set-Location backend
bun run db:migrate
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to run migrations" -ForegroundColor Red
    Set-Location ..
    exit 1
}

Write-Host "[6/6] Seeding database with initial data..." -ForegroundColor Green
bun run db:seed
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to seed database" -ForegroundColor Red
    Set-Location ..
    exit 1
}

Set-Location ..

Write-Host ""
Write-Host "================================" -ForegroundColor Green
Write-Host "✅ Database reset complete!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Start all services: docker-compose up -d" -ForegroundColor White
Write-Host "  2. Or start backend dev: cd backend && bun run dev" -ForegroundColor White
Write-Host ""
Write-Host "Database credentials:" -ForegroundColor Cyan
Write-Host "  Host: localhost:5432" -ForegroundColor White
Write-Host "  Database: ttue_dev" -ForegroundColor White
Write-Host "  User: postgres" -ForegroundColor White
Write-Host "  Password: postgres" -ForegroundColor White
Write-Host ""
Write-Host "Seeded data includes:" -ForegroundColor Cyan
Write-Host "  - 1 seed user (seed_user@earthforum.com)" -ForegroundColor White
Write-Host "  - 3 challenges with ideas and comments" -ForegroundColor White
Write-Host ""
