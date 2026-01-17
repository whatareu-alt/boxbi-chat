# Railway Deployment - Quick Start

## Files Changed/Created ✅

### Backend (server-spring/)

- ✅ `Procfile` - Tells Railway how to start your app
- ✅ `railway.json` - Railway build configuration
- ✅ `application.properties` - Updated for PostgreSQL support
- ✅ `WebSocketConfig.java` - Added Railway CORS support

### Frontend (root/)

- ✅ `nixpacks.toml` - For Railway static site deployment
- ⚠️ `index.html` - **YOU NEED TO UPDATE** line 695 with your Railway backend URL

## Quick Deployment Steps

### 1. Backend to Railway

```bash
# Push to GitHub
git add .
git commit -m "Configure for Railway deployment"
git push origin main

# Then in Railway:
# 1. New Project → Deploy from GitHub
# 2. Select your repo, root dir: server-spring
# 3. Add PostgreSQL database
# 4. Set environment variable: JWT_SECRET=<generate-random-64-char-string>
# 5. Deploy!
```

### 2. Frontend to Railway or Netlify

**Option A - Railway:**

1. New service from same repo
2. Root directory: `/` (project root)
3. Update `index.html` line 695: `const API_URL = 'https://your-backend.railway.app';`

**Option B - Netlify (Recommended):**

1. Update `index.html` line 695 with Railway backend URL
2. Drag & drop to Netlify

## Environment Variables Needed

Railway will auto-set these from PostgreSQL:

- `DATABASE_URL`
- `DB_USERNAME`
- `DB_PASSWORD`

**You must manually add:**

```
JWT_SECRET=<your-64-character-random-string>
COOKIE_SECURE=true
JPA_DDL_AUTO=update
HIBERNATE_DIALECT=org.hibernate.dialect.PostgreSQLDialect
```

## Generate JWT Secret

```powershell
# Windows PowerShell:
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
```

## What Changed?

1. **Database**: Switched from H2 (local) to PostgreSQL (Railway)
2. **Port**: Uses Railway's dynamic `$PORT` variable
3. **CORS**: Added `https://*.railway.app` to allowed origins
4. **Config**: All settings use environment variables for flexibility

## Testing After Deployment

1. Visit backend URL: `https://your-app.railway.app`
2. Open frontend in 2 browser windows
3. Create 2 users, send messages
4. Verify real-time delivery works!

## Full Guide

See `RAILWAY_DEPLOYMENT.md` for complete step-by-step instructions.
