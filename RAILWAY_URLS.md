# Railway Deployment URLs

## Production Environment

### Backend

- **URL**: <https://zoobi-chat-backend-production.up.railway.app>
- **Service**: Spring Boot API + WebSocket
- **Database**: PostgreSQL

### Database

- **Host**: yamabiko.proxy.rlwy.net
- **Port**: 16153
- **Type**: PostgreSQL
- **Connection**: Managed by Railway (DATABASE_URL environment variable)

### Frontend

- **URL**: <https://fullstack-chat-main-production.up.railway.app>
- **Deploy to**: Railway
- **API_URL**: <https://zoobi-chat-backend-production.up.railway.app>

## Environment Variables (Railway Backend)

These are automatically set by Railway when you add PostgreSQL:

```
DATABASE_URL=postgresql://postgres:[password]@postgres-production-ceff0.up.railway.app:5432/railway
DB_USERNAME=postgres
DB_PASSWORD=[auto-generated]
PORT=[auto-assigned]
```

You need to manually add:

```
JWT_SECRET=[your-64-character-random-string]
COOKIE_SECURE=true
JPA_DDL_AUTO=update
HIBERNATE_DIALECT=org.hibernate.dialect.PostgreSQLDialect
```

## Quick Test

1. **Backend Health**: Visit <https://zoobi-chat-backend-production.up.railway.app>
2. **WebSocket**: Check browser console when connecting
3. **Database**: Verify in Railway dashboard → PostgreSQL → Data

## Next Steps

1. ✅ Backend URL updated in `index.html`
2. ⏳ Deploy frontend to Railway or Netlify
3. ⏳ Test real-time messaging with 2 users
4. ⏳ Configure custom domain (optional)

## CORS Configuration

Your backend already allows:

- `https://*.railway.app` ✅
- `https://*.netlify.app` ✅
- `https://boxbi.online` ✅

## Deployment Commands

```bash
# Commit changes
git add .
git commit -m "Update API_URL for Railway production"
git push origin main

# Railway will auto-deploy backend
# For frontend: deploy to Netlify or create new Railway service
```
