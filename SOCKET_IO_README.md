# Chat Application - Self-Hosted with Socket.IO (WebSocket)

This chat application has been migrated from ChatEngine.io to a **self-hosted solution** using **Spring Boot WebSocket** with **SockJS/STOMP** (which provides Socket.IO-like real-time functionality).

## 🎯 Changes Made

### ✅ Removed ChatEngine.io
- ❌ Removed all ChatEngine.io API calls from backend
- ❌ Removed ChatEngine.io credentials (Project ID, Private Key)
- ❌ Removed external dependencies (org.json, gson)
- ❌ No longer dependent on external chat service

### ✅ Added Socket.IO (WebSocket) Implementation
- ✅ Added Spring Boot WebSocket with SockJS/STOMP
- ✅ Implemented real-time messaging with WebSocket
- ✅ Added in-memory user authentication
- ✅ Created modern chat UI with Socket.IO client

## 🚀 Quick Start

### Prerequisites
- Java 21 or higher
- Maven
- Modern web browser

### Backend (Spring Boot)

1. **Navigate to the server directory:**
   ```bash
   cd server-spring
   ```

2. **Build and run the server:**
   ```bash
   mvn clean install
   mvn spring-boot:run
   ```

   The server will start on `http://localhost:8080`

### Frontend (HTML + Socket.IO)

1. **Open the chat application:**
   Simply open `chat-app.html` in your web browser
   
   Or use a simple HTTP server:
   ```bash
   # Using Python
   python -m http.server 3000
   
   # Using Node.js
   npx http-server -p 3000
   ```

2. **Access the app:**
   Open `http://localhost:3000/chat-app.html` in multiple browser tabs to test chat

## 📡 Architecture

### Backend (Spring Boot)
- **WebSocket Configuration:** `WebSocketConfig.java`
  - Endpoint: `/ws` (with SockJS fallback)
  - Message broker: `/topic`
  - Application destination: `/app`

- **Chat Controller:** `ChatController.java`
  - `/app/chat.sendMessage` - Send messages
  - `/app/chat.addUser` - User joins chat
  - Broadcasts to `/topic/public`

- **User Controller:** `UserController.java`
  - `POST /login` - User login (in-memory)
  - `POST /signup` - User registration (in-memory)

- **Message Model:** `ChatMessage.java`
  - Properties: type, content, sender, timestamp

### Frontend (HTML + SockJS/STOMP)
- **SockJS:** WebSocket emulation with fallbacks
- **STOMP:** Simple messaging protocol over WebSocket
- **Real-time features:**
  - Join/leave notifications
  - Instant message delivery
  - Modern, responsive UI

## 🔧 API Endpoints

### Authentication
```
POST http://localhost:8080/login
Content-Type: application/json

{
  "username": "user1",
  "secret": "password123"
}
```

```
POST http://localhost:8080/signup
Content-Type: application/json

{
  "username": "user1",
  "email": "user1@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "secret": "password123"
}
```

### WebSocket Connection
```javascript
// Connect to WebSocket
const socket = new SockJS('http://localhost:8080/ws');
const stompClient = Stomp.over(socket);

stompClient.connect({}, (frame) => {
  // Subscribe to messages
  stompClient.subscribe('/topic/public', (message) => {
    console.log(message.body);
  });
  
  // Send message
  stompClient.send('/app/chat.sendMessage', {}, JSON.stringify({
    sender: 'username',
    content: 'Hello!',
    type: 'CHAT'
  }));
});
```

## 📝 Message Types

- **CHAT:** Regular chat message
- **JOIN:** User joined the chat
- **LEAVE:** User left the chat

## 🔐 Security Notes

⚠️ **Current implementation uses in-memory storage for demonstration purposes.**

For production use, you should:
- Add a database (MySQL, PostgreSQL, MongoDB)
- Implement JWT authentication
- Add password hashing (BCrypt)
- Add HTTPS/WSS support
- Implement rate limiting
- Add input validation and sanitization

## 🎨 Features

- ✅ Real-time messaging with WebSocket
- ✅ User authentication (login/signup)
- ✅ Join/leave notifications
- ✅ Message timestamps
- ✅ Modern, responsive UI
- ✅ No external dependencies (fully self-hosted)

## 📦 Dependencies

### Backend (pom.xml)
```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
</dependency>
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-websocket</artifactId>
</dependency>
```

### Frontend (CDN)
- SockJS Client: `https://cdn.jsdelivr.net/npm/sockjs-client@1/dist/sockjs.min.js`
- STOMP.js: `https://cdn.jsdelivr.net/npm/stompjs@2.3.3/lib/stomp.min.js`

## 🌟 Next Steps

1. **Add Database Integration:**
   - Spring Data JPA
   - MySQL/PostgreSQL for user storage
   - Message history persistence

2. **Enhance Security:**
   - JWT tokens
   - Password encryption
   - CORS configuration

3. **Add Features:**
   - Private messaging
   - Chat rooms
   - File sharing
   - User profiles
   - Online status indicators

## 🐛 Troubleshooting

**WebSocket connection fails:**
- Ensure the Spring Boot server is running on port 8080
- Check browser console for errors
- Verify CORS settings

**Login/Signup not working:**
- Check that the API URL is correct (`http://localhost:8080`)
- Ensure the server is accessible
- Check network tab in browser DevTools

**Messages not appearing:**
- Verify WebSocket connection is established
- Check that you're subscribed to `/topic/public`
- Look for errors in browser and server console

## 📄 License

This project is open source and available for educational purposes.
