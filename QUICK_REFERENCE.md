# Quick Reference - Socket.IO Chat Application

## 🚀 One-Command Start

### Option 1: HTML Client (No Build Required)
```bash
# Terminal 1: Start backend
cd server-spring && mvn spring-boot:run

# Terminal 2: Serve frontend (optional)
python -m http.server 3000

# Then open: http://localhost:3000/chat-app.html
# Or just double-click chat-app.html
```

### Option 2: React Client
```bash
# Terminal 1: Start backend
cd server-spring && mvn spring-boot:run

# Terminal 2: Start React
cd client-react && npm install && npm start
```

---

## 📍 Endpoints

### REST API (Authentication)
- **POST** `http://localhost:8080/login` - User login
- **POST** `http://localhost:8080/signup` - User registration

### WebSocket (Real-time)
- **Connect:** `ws://localhost:8080/ws`
- **Subscribe:** `/topic/public` (receive messages)
- **Send:** `/app/chat.sendMessage` (send chat)
- **Join:** `/app/chat.addUser` (notify join)

---

## 💬 Message Types

```javascript
{
  sender: "username",
  content: "message text",
  type: "CHAT" | "JOIN" | "LEAVE",
  timestamp: 1234567890
}
```

---

## 🔧 Common Issues & Solutions

| Problem | Solution |
|---------|----------|
| Backend won't start | Check if port 8080 is in use: `netstat -ano \| findstr :8080` |
| WebSocket fails | Ensure backend is running, check CORS settings |
| React won't build | Run `npm install` to get new Socket.IO dependencies |
| Messages not appearing | Check connection status, verify subscription to `/topic/public` |
| CORS errors | Add `@CrossOrigin` to controllers |

---

## 📦 Dependencies

### Backend (pom.xml)
```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-websocket</artifactId>
</dependency>
```

### Frontend (package.json)
```json
{
  "sockjs-client": "^1.6.1",
  "@stomp/stompjs": "^7.0.0"
}
```

---

## 🎯 Key Files

### Backend
- `UserController.java` - Auth (login/signup)
- `ChatController.java` - Real-time messaging
- `WebSocketConfig.java` - WebSocket setup
- `ChatMessage.java` - Message model

### Frontend (HTML)
- `chat-app.html` - Complete standalone app

### Frontend (React)
- `src/app.js` - Main routing
- `src/authPage.js` - Login/signup
- `src/chatsPage.js` - Chat interface
- `src/index.css` - Styles

---

## ✅ What Changed

### Removed ❌
- ChatEngine.io API calls
- ChatEngine.io credentials
- External dependencies (org.json, gson)
- react-chat-engine-* packages

### Added ✅
- In-memory user authentication
- SockJS/STOMP WebSocket
- Custom chat UI
- Real-time messaging
- Full self-hosted solution

---

## 🔐 Production Checklist

Before deploying to production:

- [ ] Add database (replace in-memory storage)
- [ ] Hash passwords (BCrypt)
- [ ] Implement JWT authentication
- [ ] Add HTTPS/WSS
- [ ] Configure CORS properly
- [ ] Add rate limiting
- [ ] Implement input validation
- [ ] Set up logging/monitoring
- [ ] Add error handling
- [ ] Write tests

---

## 📚 Documentation

- **MIGRATION_COMPLETE.md** - Full migration summary
- **SOCKET_IO_README.md** - Architecture and setup
- **client-react/README.md** - React-specific guide
- **CHANGES_SUMMARY.md** - Detailed changes

---

## 🎨 Features

✅ Real-time messaging  
✅ User authentication  
✅ Join/leave notifications  
✅ Message timestamps  
✅ Connection status  
✅ Auto-scroll  
✅ Modern UI  
✅ Responsive design  

---

## 💡 Testing Flow

1. Start Spring Boot backend (port 8080)
2. Open chat app (HTML or React)
3. Open in 2 browser tabs/windows
4. Sign up as different users:
   - Tab 1: `alice` / `password123`
   - Tab 2: `bob` / `password123`
5. Send messages between tabs
6. See real-time updates!

---

**Status:** ✅ Ready to Use  
**ChatEngine.io:** ❌ Removed  
**Socket.IO:** ✅ Working  
