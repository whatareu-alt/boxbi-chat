# Railway Deployment Guide

## Prerequisites

- Railway account (sign up at <https://railway.app>)
- GitHub repository with your code
- PostgreSQL database (Railway provides this)

## Backend Deployment (Spring Boot)

### Step 1: Prepare Your Repository

Ensure these files are in your `server-spring` directory:

- ✅ `Procfile` - Created
- ✅ `railway.json` - Created  
- ✅ `pom.xml` - PostgreSQL dependency included
- ✅ `application.properties` - Updated for Railway

### Step 2: Push to GitHub

```bash
cd c:\Users\ragha\Downloads\zoobi
git add .
git commit -m "Configure for Railway deployment"
git push origin main
```

### Step 3: Create Railway Project

1. Go to <https://railway.app/new>
2. Click "Deploy from GitHub repo"
3. Select your repository
4. Choose `server-spring` as the root directory

### Step 4: Add PostgreSQL Database

1. In your Railway project, click "+ New"
2. Select "Database" → "PostgreSQL"
3. Railway will automatically create a PostgreSQL instance
4. The `DATABASE_URL` variable will be auto-injected

### Step 5: Configure Environment Variables

In Railway project settings → Variables, add:

```bash
# Railway auto-provides these from PostgreSQL:
# DATABASE_URL (automatically set)
# DB_USERNAME (automatically set)
# DB_PASSWORD (automatically set)

# You need to add these manually:
JWT_SECRET=your-super-secure-random-string-at-least-32-characters-long-change-this
COOKIE_SECURE=true
JPA_DDL_AUTO=update
HIBERNATE_DIALECT=org.hibernate.dialect.PostgreSQLDialect
LOG_LEVEL=INFO
APP_LOG_LEVEL=INFO
```

**Generate a secure JWT_SECRET:**

```bash
# On Windows PowerShell:
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
```

### Step 6: Deploy

1. Railway will automatically build and deploy
2. Wait for deployment to complete
3. Note your backend URL: `https://your-app.railway.app`

### Step 7: Test Backend

Visit: `https://your-app.railway.app/health` (if you have a health endpoint)

## Frontend Deployment

### Option A: Deploy Frontend to Railway

#### Step 1: Create `nixpacks.toml` in root directory

```toml
[phases.setup]
nixPkgs = ["nodejs"]

[phases.build]
cmds = ["echo 'No build needed for static site'"]

[start]
cmd = "npx http-server . -p $PORT"
```

#### Step 2: Update `index.html`

Change line 695:

```javascript
const API_URL = 'https://your-backend.railway.app';
```

#### Step 3: Deploy to Railway

1. Create a new Railway service
2. Deploy from the same GitHub repo
3. Set root directory to `/` (project root)
4. Railway will serve your static files

### Option B: Deploy Frontend to Netlify (Recommended)

#### Step 1: Update `index.html`

```javascript
const API_URL = 'https://your-backend.railway.app';
```

#### Step 2: Deploy to Netlify

1. Go to <https://app.netlify.com>
2. Drag and drop your project folder
3. Or connect to GitHub for continuous deployment

#### Step 3: Configure Custom Domain (Optional)

1. In Netlify: Site settings → Domain management
2. Add your custom domain (e.g., `boxbi.online`)
3. Update DNS records as instructed

## Post-Deployment Configuration

### Update Backend CORS

If your frontend URL is different from what's configured, update `WebSocketConfig.java`:

```java
.setAllowedOriginPatterns(
    "https://your-frontend.railway.app",
    "https://your-custom-domain.com",
    "https://*.netlify.app"
)
```

Redeploy the backend after this change.

## Environment Variables Reference

### Backend (Railway)

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Auto-set by Railway |
| `DB_USERNAME` | Database username | Auto-set by Railway |
| `DB_PASSWORD` | Database password | Auto-set by Railway |
| `JWT_SECRET` | Secret key for JWT tokens | `your-64-char-random-string` |
| `PORT` | Server port | Auto-set by Railway |
| `COOKIE_SECURE` | Enable secure cookies | `true` |
| `JPA_DDL_AUTO` | Hibernate DDL mode | `update` |
| `HIBERNATE_DIALECT` | Database dialect | `org.hibernate.dialect.PostgreSQLDialect` |

## Testing Your Deployment

### 1. Test Backend Health

```bash
curl https://your-backend.railway.app/health
```

### 2. Test User Signup

Open your frontend and create a new user account.

### 3. Test Real-Time Messaging

1. Open frontend in two different browser windows
2. Login as two different users
3. Send friend request and accept
4. Send messages and verify real-time delivery

## Troubleshooting

### Issue: Build Fails

**Solution:** Check Railway build logs

- Ensure Java 21 is specified in `pom.xml`
- Verify all dependencies are correct

### Issue: Database Connection Error

**Solution:** Verify environment variables

```bash
# Check in Railway dashboard that these are set:
DATABASE_URL
DB_USERNAME  
DB_PASSWORD
```

### Issue: CORS Errors

**Solution:** Update allowed origins in `WebSocketConfig.java`

```java
.setAllowedOriginPatterns("https://your-actual-frontend-url.com")
```

### Issue: WebSocket Connection Fails

**Solution:**

1. Ensure frontend uses `https://` (not `http://`)
2. Check browser console for errors
3. Verify CORS configuration includes your frontend URL

## Monitoring

### Railway Dashboard

- View logs: Railway project → Deployments → Logs
- Monitor metrics: CPU, Memory, Network usage
- Check database: PostgreSQL service → Data tab

### Application Logs

Set `APP_LOG_LEVEL=DEBUG` to see detailed logs during troubleshooting.

## Scaling

Railway automatically scales based on your plan:

- **Hobby Plan**: $5/month, suitable for small projects
- **Pro Plan**: $20/month, better performance and resources

## Security Checklist

- ✅ JWT_SECRET is a strong random string
- ✅ COOKIE_SECURE is set to `true`
- ✅ CORS only allows specific origins (not `*` in production)
- ✅ Database credentials are environment variables
- ✅ HTTPS is enabled (Railway provides this automatically)

## Next Steps

1. Set up custom domain (optional)
2. Configure monitoring and alerts
3. Set up automated backups for PostgreSQL
4. Implement rate limiting for production
5. Add health check endpoints

## Support

- Railway Docs: <https://docs.railway.app>
- Railway Discord: <https://discord.gg/railway>
- Spring Boot Docs: <https://spring.io/projects/spring-boot>
