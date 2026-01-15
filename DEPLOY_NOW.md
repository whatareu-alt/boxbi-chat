# 🚀 Deploy Zoobi Chat Globally - Step by Step Guide

**Status:** Ready to deploy! ✅  
**Time Required:** 30-45 minutes  
**Cost:** FREE (using free tiers)

---

## 📋 What We'll Do

1. ✅ Install Git (if needed)
2. ✅ Push code to GitHub
3. ✅ Deploy backend to Render.com
4. ✅ Deploy frontend to Netlify
5. ✅ Test globally!

---

## Step 1: Install Git

### Option A: Download Git for Windows
1. Go to: https://git-scm.com/download/win
2. Download and install (use default settings)
3. Restart PowerShell/Terminal

### Option B: Use GitHub Desktop (Easier!)
1. Go to: https://desktop.github.com/
2. Download and install
3. Sign in with your GitHub account
4. Skip to Step 2B

---

## Step 2A: Push to GitHub (Command Line)

**Your repository is already initialized!**  
Remote: `https://github.com/zoobichata/fullstack-chat-main.git`

### Commands to run:

```powershell
# Navigate to project
cd c:\Users\ragha\Downloads\zoobi

# Check status
git status

# Add all files
git add .

# Commit changes
git commit -m "Ready for global deployment"

# Push to GitHub
git push origin main
```

If you get authentication errors, you'll need to:
1. Create a Personal Access Token on GitHub
2. Go to: https://github.com/settings/tokens
3. Generate new token (classic)
4. Select: `repo` scope
5. Use token as password when pushing

---

## Step 2B: Push to GitHub (GitHub Desktop)

1. Open GitHub Desktop
2. File → Add Local Repository
3. Choose: `c:\Users\ragha\Downloads\zoobi`
4. Click "Commit to main" (bottom left)
5. Click "Push origin" (top right)

---

## Step 3: Deploy Backend to Render.com

### 3.1 Sign Up for Render
1. Go to: https://render.com
2. Click "Get Started"
3. Sign up with GitHub (easiest option)
4. Authorize Render to access your repositories

### 3.2 Create Web Service
1. Click "New +" → "Web Service"
2. Connect your GitHub repository: `fullstack-chat-main`
3. Click "Connect"

### 3.3 Configure Service
Fill in these settings:

```
Name: zoobi-chat-backend
Region: Oregon (US West) - good for global access
Branch: main
Root Directory: server-spring
Runtime: Java
Build Command: ./mvnw clean install -DskipTests
Start Command: java -jar target/server-spring-0.0.1-SNAPSHOT.jar
Instance Type: Free
```

### 3.4 Add Environment Variables
Click "Advanced" → "Add Environment Variable"

Add these:
```
SERVER_PORT=8080
SPRING_DATASOURCE_URL=jdbc:h2:file:./data/chat_db
```

### 3.5 Deploy!
1. Click "Create Web Service"
2. Wait 5-10 minutes for deployment
3. You'll get a URL like: `https://zoobi-chat-backend.onrender.com`
4. **SAVE THIS URL!** You'll need it for the frontend

### 3.6 Verify Backend
Once deployed, test it:
- Open: `https://zoobi-chat-backend.onrender.com/h2-console`
- You should see the H2 database console

---

## Step 4: Prepare Frontend for Deployment

We need to update the frontend to use your Render backend URL.

### 4.1 Create Production Frontend File

I'll create an `index.html` file with your Render backend URL.

**IMPORTANT:** Replace `YOUR_RENDER_URL` with your actual Render URL from Step 3.5

---

## Step 5: Deploy Frontend to Netlify

### 5.1 Sign Up for Netlify
1. Go to: https://netlify.com
2. Click "Sign up"
3. Sign up with GitHub

### 5.2 Deploy Site
1. Click "Add new site" → "Import an existing project"
2. Choose "GitHub"
3. Select your repository: `fullstack-chat-main`
4. Configure build settings:
   ```
   Build command: (leave empty)
   Publish directory: .
   ```
5. Click "Deploy site"

### 5.3 Get Your URL
- Netlify will give you a URL like: `https://random-name-12345.netlify.app`
- You can customize it: Site settings → Domain management → Change site name
- Suggested name: `zoobi-chat` → `https://zoobi-chat.netlify.app`

---

## Step 6: Update Frontend with Backend URL

### 6.1 Edit chat-app.html
Find line 340 and update:

```javascript
// OLD:
const API_URL = 'http://localhost:8080';

// NEW (replace with YOUR Render URL):
const API_URL = 'https://zoobi-chat-backend.onrender.com';
```

### 6.2 Push Changes
```powershell
git add chat-app.html
git commit -m "Update API URL for production"
git push origin main
```

Netlify will automatically redeploy!

---

## Step 7: Update CORS Settings (Important!)

Your backend needs to allow requests from your Netlify domain.

### 7.1 Update WebSocketConfig.java

Find the `setAllowedOriginPatterns` line and update:

```java
.setAllowedOriginPatterns(
    "https://zoobi-chat.netlify.app",  // Your Netlify URL
    "https://*.netlify.app",            // All Netlify subdomains
    "http://localhost:*"                // Keep for local testing
)
```

### 7.2 Update UserController.java

Update the `@CrossOrigin` annotation:

```java
@CrossOrigin(origins = {
    "https://zoobi-chat.netlify.app",
    "https://*.netlify.app",
    "http://localhost:*"
})
```

### 7.3 Push and Redeploy
```powershell
git add .
git commit -m "Update CORS for production"
git push origin main
```

Render will automatically redeploy!

---

## Step 8: Test Your Global App! 🎉

### 8.1 Access Your App
Open your Netlify URL: `https://zoobi-chat.netlify.app`

### 8.2 Test Signup
1. Click "Sign up"
2. Create a new account
3. You should be logged in automatically

### 8.3 Test Chat
1. Open the app in another browser/device
2. Sign up with a different account
3. Send messages between accounts
4. Verify real-time messaging works!

### 8.4 Share with the World! 🌍
Your app is now accessible from anywhere:
- Share the URL: `https://zoobi-chat.netlify.app`
- Anyone can access it from any device
- Works on mobile, tablet, desktop

---

## 🎯 Quick Reference

### Your URLs (Update after deployment):
- **Frontend:** `https://zoobi-chat.netlify.app`
- **Backend:** `https://zoobi-chat-backend.onrender.com`
- **GitHub:** `https://github.com/zoobichata/fullstack-chat-main`

### Important Notes:
- ⚠️ Render free tier: App sleeps after 15 min of inactivity
- ⚠️ First request after sleep takes ~30 seconds to wake up
- ✅ Netlify is always fast (CDN-powered)
- ✅ Both services provide free SSL (HTTPS)

---

## 🔧 Troubleshooting

### "CORS Error"
- Make sure you updated CORS settings in both files
- Redeploy backend on Render
- Clear browser cache

### "Connection Error"
- Check if backend is awake (visit the URL)
- Verify API_URL in frontend matches your Render URL
- Check browser console (F12) for detailed errors

### "WebSocket Error"
- Ensure backend URL uses `https://` not `http://`
- Verify CORS allows your Netlify domain
- Check Render logs for errors

### Backend Won't Deploy
- Check Render build logs
- Verify Java version (should be 21)
- Ensure `mvnw` file has execute permissions

---

## 📊 Deployment Checklist

### Pre-Deployment
- [x] Code working locally
- [x] Git repository exists
- [ ] Git installed (or GitHub Desktop)
- [ ] GitHub account created

### Backend (Render)
- [ ] Render account created
- [ ] Web service created
- [ ] Environment variables set
- [ ] Deployment successful
- [ ] Backend URL saved

### Frontend (Netlify)
- [ ] Netlify account created
- [ ] Site deployed
- [ ] API_URL updated in code
- [ ] Changes pushed to GitHub
- [ ] Frontend URL saved

### Production Ready
- [ ] CORS updated for production
- [ ] Backend redeployed with CORS changes
- [ ] Tested signup
- [ ] Tested login
- [ ] Tested messaging
- [ ] Shared with friends!

---

## 🚀 Next Steps (Optional)

### Upgrade to PostgreSQL (Better than H2)
1. In Render: New + → PostgreSQL
2. Link to your web service
3. Update `pom.xml` to include PostgreSQL driver
4. Update `application.properties`

### Add Custom Domain
1. Buy domain from Namecheap (~$10/year)
2. Configure in Netlify: Domain settings
3. Update DNS records
4. Free SSL included!

### Add Password Hashing
1. Add Spring Security dependency
2. Use BCrypt for password hashing
3. Update login/signup logic

---

## 💰 Cost Summary

**Current Setup (Free Tier):**
- Render: FREE (750 hours/month)
- Netlify: FREE (100GB bandwidth)
- GitHub: FREE (public repo)
- **Total: $0/month** ✅

**After Free Trial:**
- Render: $7/month (if you exceed free tier)
- Netlify: Still FREE
- **Total: $0-7/month**

---

## 🎉 Congratulations!

Once deployed, your Zoobi chat app will be:
- ✅ Accessible from anywhere in the world
- ✅ Secure with HTTPS
- ✅ Fast with CDN (Netlify)
- ✅ Scalable (can handle many users)
- ✅ Professional (custom domain optional)

**You're ready to share your app with the world!** 🌍

---

**Need Help?**
- Render Docs: https://render.com/docs
- Netlify Docs: https://docs.netlify.com
- Spring Boot Docs: https://spring.io/guides

**Last Updated:** January 15, 2026  
**Status:** Ready to Deploy! 🚀
