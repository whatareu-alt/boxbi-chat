# ============================================================
# FRESH DEPLOYMENT GUIDE - ZOOBI CHAT APP
# ============================================================
# Follow these steps to deploy from scratch
# ============================================================

# ============================================================
# STEP 1: CLEAN UP OLD DEPLOYMENTS
# ============================================================

## On Render:
1. Go to https://dashboard.render.com
2. Delete old Web Service (if exists)
3. Delete old PostgreSQL database (if exists)
   - Click on each service → Settings → Delete Service

## On Netlify:
1. Go to https://app.netlify.com
2. Delete old site (if exists)
   - Click on site → Site settings → Delete site

# ============================================================
# STEP 2: DEPLOY BACKEND TO RENDER
# ============================================================

## 2A: Create New Web Service
1. Go to Render Dashboard
2. Click "New +" → "Web Service"
3. Connect your GitHub repository: zoobichata/fullstack-chat-main
4. Configure settings:

   Name: zoobi-chat-backend
   Region: Oregon (US West) or closest to you
   Branch: main
   Root Directory: server-spring
   Runtime: Java
   Build Command: ./mvnw clean package -DskipTests
   Start Command: java -jar target/server-spring-0.0.1-SNAPSHOT.jar
   Instance Type: Free

5. Click "Create Web Service"

## 2B: Add Environment Variables
After creating, go to Environment tab and add ONLY these 2:

SERVER_PORT=8080
JAVA_VERSION=21

6. Click "Save Changes"
7. Wait for deployment to complete (~3-5 minutes)
8. Copy your backend URL (looks like: https://zoobi-chat-backend.onrender.com)

# ============================================================
# STEP 3: UPDATE FRONTEND CODE
# ============================================================

You need to update chat-realtime.html with your new Render URL.

Find this line (around line 368):
const socketUrl = isLocal ? 'http://localhost:8080/ws' : 'https://fullstack-chat-main-atn4.onrender.com/ws';

Replace with YOUR new Render URL:
const socketUrl = isLocal ? 'http://localhost:8080/ws' : 'https://YOUR-NEW-RENDER-URL.onrender.com/ws';

# ============================================================
# STEP 4: DEPLOY FRONTEND TO NETLIFY
# ============================================================

## 4A: Create New Site
1. Go to https://app.netlify.com
2. Click "Add new site" → "Import an existing project"
3. Choose "Deploy with GitHub"
4. Select your repository: zoobichata/fullstack-chat-main
5. Configure settings:

   Branch to deploy: main
   Base directory: (leave empty)
   Build command: (leave empty - we're deploying static files)
   Publish directory: .

6. Click "Deploy site"

## 4B: Configure Site Settings
1. After deployment, go to Site settings
2. Change site name to something memorable (optional)
3. If you have a custom domain (boxbi.online):
   - Go to Domain management → Add custom domain
   - Follow DNS configuration steps

# ============================================================
# STEP 5: UPDATE CORS IN BACKEND
# ============================================================

After you get your Netlify URL (e.g., https://zoobi-chat.netlify.app),
you need to add it to WebSocketConfig.java allowed origins.

The file already has:
- https://zoobichatapp.netlify.app
- https://boxbi.online
- https://www.boxbi.online

If your Netlify URL is different, let me know and I'll update it.

# ============================================================
# STEP 6: TEST YOUR DEPLOYMENT
# ============================================================

1. Open your Netlify URL in browser
2. Enter a username
3. Send a message
4. Open in another browser/incognito to test real-time chat

# ============================================================
# TROUBLESHOOTING
# ============================================================

## Backend won't start on Render:
- Check Logs in Render dashboard
- Ensure only SERVER_PORT and JAVA_VERSION are set
- Make sure Root Directory is "server-spring"

## Frontend can't connect:
- Check browser console (F12)
- Verify backend URL in chat-realtime.html matches your Render URL
- Ensure backend is "Live" in Render dashboard

## CORS errors:
- Add your Netlify URL to WebSocketConfig.java
- Redeploy backend after updating

# ============================================================
# CURRENT STATUS
# ============================================================

✅ Code is ready
✅ GitHub repository exists
⏳ Waiting for you to:
   1. Delete old Render/Netlify deployments
   2. Create new deployments following steps above
   3. Share your new Render URL so I can update the frontend

# ============================================================
