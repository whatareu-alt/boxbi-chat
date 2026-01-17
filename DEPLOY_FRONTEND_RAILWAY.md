# Deploy Frontend to Railway - Step by Step

## Prerequisites

✅ Backend already deployed: `https://zoobi-chat-backend-production.up.railway.app`
✅ `index.html` updated with backend URL
✅ Configuration files ready (`nixpacks.toml` and `railway.json`)

## Deployment Steps

### Step 1: Push to GitHub

```bash
cd c:\Users\ragha\Downloads\zoobi
git add .
git commit -m "Configure frontend for Railway deployment"
git push origin main
```

### Step 2: Create New Railway Service

1. Go to your Railway dashboard: <https://railway.app/dashboard>
2. Open your existing project (where backend is deployed)
3. Click **"+ New"** button
4. Select **"GitHub Repo"**
5. Choose your repository
6. **Important**: Set **Root Directory** to `/` (leave empty or use `/`)

### Step 3: Configure Service

Railway will automatically detect `nixpacks.toml` and `railway.json`.

**Verify Settings:**

- Builder: NIXPACKS
- Start Command: `npx http-server . -p $PORT`
- Root Directory: `/` (project root)

### Step 4: Deploy

1. Click **"Deploy"**
2. Wait for build to complete (2-3 minutes)
3. Railway will assign a URL like: `https://zoobi-chat-frontend-production.up.railway.app`

### Step 5: Test Your Deployment

1. **Open Frontend**: Visit your Railway frontend URL
2. **Open in 2 Windows**: Test with 2 different browser windows
3. **Create Users**: Sign up as `testuser1` and `testuser2`
4. **Send Friend Request**: From one user to another
5. **Accept Request**: In the other window
6. **Send Messages**: Test real-time messaging!

## Expected URLs

After deployment, you'll have:

- **Backend**: <https://zoobi-chat-backend-production.up.railway.app>
- **Frontend**: <https://zoobi-chat-frontend-production.up.railway.app> (or similar)
- **Database**: postgres-production-ceff0.up.railway.app

## Troubleshooting

### Issue: Build Fails

**Check:**

- `nixpacks.toml` is in project root
- `railway.json` is in project root
- Root directory is set to `/`

### Issue: Site Loads but Can't Connect to Backend

**Check:**

1. Browser console for errors
2. Verify `index.html` line 695 has correct backend URL
3. Check CORS in backend allows your frontend URL

### Issue: 404 Not Found

**Solution:**

- Ensure `index.html` is in project root
- Verify Railway is serving from correct directory

## Alternative: Use Railway CLI

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link to project
railway link

# Deploy
railway up
```

## Custom Domain (Optional)

1. In Railway dashboard → Frontend service
2. Click **"Settings"** → **"Domains"**
3. Click **"Generate Domain"** or **"Custom Domain"**
4. Add your domain (e.g., `chat.boxbi.online`)
5. Update DNS records as instructed

## What Happens During Deployment

1. Railway detects `nixpacks.toml`
2. Installs Node.js
3. Runs build commands (none needed for static site)
4. Starts `http-server` on Railway's assigned port
5. Serves `index.html` and all static files

## Files Being Deployed

```
zoobi/
├── index.html          ← Main app
├── nixpacks.toml       ← Railway build config
├── railway.json        ← Railway deploy config
└── (all other files)
```

## Next Steps After Deployment

1. ✅ Test real-time messaging
2. ⏳ Configure custom domain (optional)
3. ⏳ Set up monitoring
4. ⏳ Share your app with users!

## Support

- Railway Docs: <https://docs.railway.app>
- Railway Discord: <https://discord.gg/railway>

---

**Ready to deploy?** Follow Step 1 above! 🚀
