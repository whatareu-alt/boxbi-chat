# 🔐 Environment Variables Guide for Render

## ✅ Files Created:
- `.env` - Your local environment variables
- `.env.example` - Template for sharing (no sensitive data)

---

## 📋 How to Add Environment Variables on Render

### Method 1: Through Render Dashboard (Recommended)

When creating your Web Service on Render:

1. **Scroll to "Advanced" section**
2. **Click "Environment Variables"**
3. **Add these variables ONE BY ONE:**

```
Key: SERVER_PORT
Value: 8080
```

```
Key: SPRING_DATASOURCE_URL
Value: jdbc:h2:file:./data/chat_db
```

**That's it!** These are the only required variables for basic deployment.

---

## 📝 Optional Variables (Add if needed)

### For H2 Console Access:
```
Key: SPRING_H2_CONSOLE_ENABLED
Value: true
```

### For Database Username:
```
Key: SPRING_DATASOURCE_USERNAME
Value: sa
```

### For Database Password:
```
Key: SPRING_DATASOURCE_PASSWORD
Value: (leave empty)
```

---

## 🔄 Method 2: Bulk Add (Advanced)

If you want to add multiple variables at once:

1. In Render dashboard, go to your Web Service
2. Click **"Environment"** tab (left sidebar)
3. Click **"Add from .env"** button
4. Paste the contents of your `.env` file
5. Click **"Save Changes"**

---

## 🚀 For PostgreSQL (When You Upgrade)

If you add a PostgreSQL database on Render:

1. Render automatically creates a `DATABASE_URL` variable
2. Add this variable:

```
Key: SPRING_DATASOURCE_URL
Value: ${DATABASE_URL}
```

3. Change database platform:

```
Key: SPRING_JPA_DATABASE_PLATFORM
Value: org.hibernate.dialect.PostgreSQLDialect
```

---

## ⚠️ Important Notes:

1. **Don't commit `.env` to Git** - It's already in `.gitignore`
2. **`.env.example` is safe to commit** - No sensitive data
3. **Render reads environment variables automatically** - No need to load them manually
4. **Changes to environment variables require redeployment** - Render will auto-redeploy

---

## 🔍 Current Required Variables for Render:

**Minimum to deploy:**
```
SERVER_PORT=8080
SPRING_DATASOURCE_URL=jdbc:h2:file:./data/chat_db
```

**Recommended (for full functionality):**
```
SERVER_PORT=8080
SPRING_DATASOURCE_URL=jdbc:h2:file:./data/chat_db
SPRING_DATASOURCE_USERNAME=sa
SPRING_DATASOURCE_PASSWORD=
SPRING_H2_CONSOLE_ENABLED=true
```

---

## ✅ Quick Copy-Paste for Render

**Copy this and paste into Render's "Add from .env" feature:**

```
SERVER_PORT=8080
SPRING_DATASOURCE_URL=jdbc:h2:file:./data/chat_db
SPRING_DATASOURCE_USERNAME=sa
SPRING_DATASOURCE_PASSWORD=
SPRING_JPA_HIBERNATE_DDL_AUTO=update
SPRING_JPA_DATABASE_PLATFORM=org.hibernate.dialect.H2Dialect
SPRING_H2_CONSOLE_ENABLED=true
```

---

**Need help adding these to Render?** Let me know which method you prefer! 🚀
