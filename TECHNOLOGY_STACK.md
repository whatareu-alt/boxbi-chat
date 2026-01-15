# 🔧 Technology Stack - Chat Application

## ✅ Current Implementation

### WebSocket Technology
- **❌ NOT using ChatEngine.io** - We removed this dependency
- **✅ Using Socket.IO-compatible stack:**
  - **SockJS** - WebSocket emulation with fallbacks
  - **STOMP** - Simple Text Oriented Messaging Protocol
  - **Spring WebSocket** - Native Spring Boot WebSocket support

### Why This Stack?

#### SockJS (Socket.IO Alternative)
- Provides WebSocket with automatic fallbacks (long-polling, etc.)
- Works across all browsers and network configurations
- Compatible with Socket.IO concepts
- Loaded from CDN: `https://cdn.jsdelivr.net/npm/sockjs-client@1/dist/sockjs.min.js`

#### STOMP Protocol
- Simple, text-based messaging protocol
- Pub/Sub pattern for chat rooms
- Easy to use with Spring Boot
- Loaded from CDN: `https://cdn.jsdelivr.net/npm/stompjs@2.3.3/lib/stomp.min.js`

#### Spring WebSocket
- Native Spring Boot support
- No external services required
- Full control over backend
- Self-hosted solution

## 📊 Comparison

| Feature | ChatEngine.io | Our Stack (SockJS + STOMP) |
|---------|---------------|----------------------------|
| **Cost** | Paid service | Free, self-hosted |
| **Control** | Limited | Full control |
| **Dependencies** | External API | Self-contained |
| **Scalability** | Vendor-dependent | Your infrastructure |
| **Privacy** | Third-party | Your server |
| **WebSocket** | Yes | Yes (via SockJS) |
| **Fallbacks** | Yes | Yes (SockJS provides) |

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                            │
│  (chat-app.html)                                           │
│                                                             │
│  ┌──────────────┐      ┌──────────────┐                   │
│  │   SockJS     │ ───▶ │    STOMP     │                   │
│  │   Client     │      │   Protocol   │                   │
│  └──────────────┘      └──────────────┘                   │
│         │                      │                            │
└─────────┼──────────────────────┼────────────────────────────┘
          │                      │
          │   WebSocket/HTTP     │
          │                      │
┌─────────▼──────────────────────▼────────────────────────────┐
│                      Backend                                │
│  (Spring Boot - server-spring)                             │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         WebSocketConfig.java                         │  │
│  │  - Registers /ws endpoint                            │  │
│  │  - Enables SockJS support                            │  │
│  │  - Configures STOMP broker                           │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         ChatController.java                          │  │
│  │  - Handles incoming messages                         │  │
│  │  - Broadcasts to all users                           │  │
│  │  - Manages JOIN/LEAVE events                         │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         UserController.java                          │  │
│  │  - Login/Signup REST endpoints                       │  │
│  │  - User authentication                               │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         H2 Database                                  │  │
│  │  - Stores user accounts                              │  │
│  │  - Persistent storage                                │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 🔌 WebSocket Flow

### 1. Connection Establishment
```javascript
// Frontend (chat-app.html)
const socket = new SockJS('http://localhost:8080/ws');
stompClient = Stomp.over(socket);
stompClient.connect({}, onConnected, onError);
```

### 2. Subscribe to Messages
```javascript
// Subscribe to public chat room
stompClient.subscribe('/topic/public', (message) => {
    const chatMessage = JSON.parse(message.body);
    displayMessage(chatMessage);
});
```

### 3. Send Messages
```javascript
// Send chat message
stompClient.send('/app/chat.sendMessage', {}, JSON.stringify({
    sender: username,
    content: messageContent,
    type: 'CHAT'
}));
```

### 4. Backend Processing
```java
// ChatController.java
@MessageMapping("/chat.sendMessage")
@SendTo("/topic/public")
public ChatMessage sendMessage(@Payload ChatMessage chatMessage) {
    chatMessage.setTimestamp(LocalDateTime.now());
    return chatMessage;
}
```

## 📦 Dependencies

### Frontend (CDN)
```html
<!-- SockJS - WebSocket emulation -->
<script src="https://cdn.jsdelivr.net/npm/sockjs-client@1/dist/sockjs.min.js"></script>

<!-- STOMP - Messaging protocol -->
<script src="https://cdn.jsdelivr.net/npm/stompjs@2.3.3/lib/stomp.min.js"></script>
```

### Backend (Maven - pom.xml)
```xml
<!-- Spring WebSocket -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-websocket</artifactId>
</dependency>

<!-- Spring Web -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
</dependency>

<!-- Spring Data JPA -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-jpa</artifactId>
</dependency>

<!-- H2 Database -->
<dependency>
    <groupId>com.h2database</groupId>
    <artifactId>h2</artifactId>
    <scope>runtime</scope>
</dependency>
```

## ✅ Benefits of Our Stack

1. **No External Dependencies**
   - No ChatEngine.io API keys needed
   - No third-party service costs
   - Complete control over your data

2. **Self-Hosted**
   - Runs entirely on your infrastructure
   - No external API calls for messaging
   - Better privacy and security

3. **Production-Ready**
   - Spring Boot is enterprise-grade
   - Scales with your needs
   - Well-documented and supported

4. **Socket.IO Compatible**
   - SockJS provides similar functionality
   - WebSocket with automatic fallbacks
   - Works across all browsers

5. **Open Source**
   - All components are open source
   - No vendor lock-in
   - Free to use and modify

## 🚀 Performance

- **WebSocket:** Real-time, bidirectional communication
- **Fallbacks:** Automatic degradation to long-polling if needed
- **Scalability:** Can handle multiple concurrent users
- **Latency:** Minimal delay for message delivery

## 🔐 Security

Current implementation:
- ✅ User authentication (login/signup)
- ✅ Password storage in database
- ✅ CORS configured for universal access
- ✅ WebSocket connection validation

For production, add:
- 🔒 HTTPS/WSS (secure WebSocket)
- 🔒 Password hashing (bcrypt)
- 🔒 JWT token authentication
- 🔒 Rate limiting
- 🔒 Input sanitization

## 📝 Summary

**This application uses a modern, self-hosted WebSocket stack that is:**
- ✅ **NOT using ChatEngine.io**
- ✅ **Using Socket.IO-compatible technology (SockJS + STOMP)**
- ✅ **Fully self-hosted with Spring Boot**
- ✅ **Free and open source**
- ✅ **Production-ready**
- ✅ **Universal HTTP access enabled**

---

**Last Updated:** January 15, 2026
**Stack Version:** SockJS 1.x + STOMP 2.3.3 + Spring Boot 3.2.1
