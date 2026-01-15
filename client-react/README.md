# React Client - Socket.IO Chat

This React application has been updated to use **Socket.IO (SockJS/STOMP)** instead of ChatEngine.io for real-time messaging.

## 🎯 What Changed

### ✅ Removed
- ❌ `react-chat-engine-pretty` package
- ❌ `react-chat-engine-advanced` package
- ❌ ChatEngine.io API integration
- ❌ External dependencies on chatengine.io

### ✅ Added
- ✅ `sockjs-client` - WebSocket client with fallbacks
- ✅ `@stomp/stompjs` - STOMP messaging protocol
- ✅ Custom chat UI components
- ✅ Real-time messaging with WebSocket
- ✅ Connection status indicator

## 📦 Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

   This will install:
   - `sockjs-client@^1.6.1` - WebSocket client
   - `@stomp/stompjs@^7.0.0` - STOMP over WebSocket
   - `axios@^1.2.0` - HTTP client for authentication

## 🚀 Running the Application

1. **Ensure the Spring Boot backend is running:**
   ```bash
   # In the server-spring directory
   mvn spring-boot:run
   ```
   Backend should be running on `http://localhost:8080`

2. **Start the React development server:**
   ```bash
   npm start
   ```
   
3. **Open in browser:**
   The app should automatically open at `http://localhost:3000`

## 🏗️ Project Structure

```
client-react/
├── src/
│   ├── app.js              # Main app component (routes between auth/chat)
│   ├── authPage.js         # Login/Signup forms
│   ├── chatsPage.js        # Chat interface with WebSocket
│   ├── index.css           # Styles for chat interface
│   └── index.js            # React entry point
├── package.json            # Updated dependencies (no ChatEngine.io)
└── README.md              # This file
```

## 🔌 WebSocket Connection

### How it works:

1. **User Authentication**
   - User logs in or signs up via REST API (`/login` or `/signup`)
   - Spring Boot returns user data
   - React stores user in state

2. **WebSocket Connection**
   - After authentication, React connects to `ws://localhost:8080/ws`
   - Uses SockJS for WebSocket with fallbacks
   - STOMP protocol for messaging

3. **Real-time Messaging**
   - Subscribe to `/topic/public` for incoming messages
   - Send messages to `/app/chat.sendMessage`
   - Join/leave notifications via `/app/chat.addUser`

### Code Example:

```javascript
// Connect to WebSocket
const socket = new SockJS('http://localhost:8080/ws');
const stompClient = Stomp.over(socket);

stompClient.connect({}, (frame) => {
  // Subscribe to public messages
  stompClient.subscribe('/topic/public', (message) => {
    const chatMessage = JSON.parse(message.body);
    // Display message in UI
  });

  // Send JOIN notification
  stompClient.send('/app/chat.addUser', {}, JSON.stringify({
    sender: username,
    type: 'JOIN'
  }));
});
```

## 📡 API Endpoints

### Authentication (REST)

**Login:**
```http
POST http://localhost:8080/login
Content-Type: application/json

{
  "username": "alice",
  "secret": "password123"
}
```

**Signup:**
```http
POST http://localhost:8080/signup
Content-Type: application/json

{
  "username": "alice",
  "secret": "password123",
  "email": "alice@example.com",
  "first_name": "Alice",
  "last_name": "Smith"
}
```

### WebSocket (STOMP)

**Subscribe to messages:**
- Topic: `/topic/public`
- Receives: All chat messages, join/leave notifications

**Send message:**
- Destination: `/app/chat.sendMessage`
- Payload: `{ sender, content, type: 'CHAT' }`

**Send join notification:**
- Destination: `/app/chat.addUser`
- Payload: `{ sender, type: 'JOIN' }`

## 🎨 Features

- ✅ Real-time messaging with WebSocket
- ✅ Login and Signup forms
- ✅ Join/leave notifications
- ✅ Message timestamps
- ✅ Connection status indicator
- ✅ Auto-scroll to latest message
- ✅ Responsive design
- ✅ Modern UI with gradients
- ✅ Message animations

## 🎯 Component Breakdown

### `app.js`
- Main component
- Routes between AuthPage and ChatsPage
- Manages user state

### `authPage.js`
- Login and signup forms
- Calls `/login` and `/signup` REST endpoints
- Validates credentials
- Passes user data to parent

### `chatsPage.js`
- Chat interface
- WebSocket connection management
- Message display (chat, join, leave)
- Message input and sending
- Connection status indicator
- Auto-scroll to bottom

### `index.css`
- Modern, clean design
- Gradient backgrounds
- Message bubbles
- Animations
- Responsive layout

## 🔧 Configuration

To change the backend URL, update these files:

**authPage.js:**
```javascript
const API_URL = 'http://localhost:8080'; // Change this
axios.post(`${API_URL}/login`, ...)
```

**chatsPage.js:**
```javascript
const WS_URL = 'http://localhost:8080/ws'; // Change this
const socket = new SockJS(WS_URL);
```

## 🐛 Troubleshooting

**WebSocket won't connect:**
- Ensure Spring Boot server is running on port 8080
- Check browser console for errors
- Verify CORS settings in Spring Boot
- Try accessing `http://localhost:8080/ws` directly

**Login/Signup fails:**
- Check that backend is running
- Open browser DevTools → Network tab
- Look for errors in the response
- Verify the API URL is correct

**Messages not appearing:**
- Check WebSocket connection status (indicator in header)
- Look for errors in browser console
- Verify you're subscribed to `/topic/public`
- Check backend logs for errors

**CORS errors:**
- Add `@CrossOrigin` annotation in Spring controllers
- Or configure CORS globally in Spring Boot

## 📝 Message Format

```typescript
interface ChatMessage {
  sender: string;      // Username
  content: string;     // Message text (for CHAT type)
  type: 'CHAT' | 'JOIN' | 'LEAVE';
  timestamp: number;   // Unix timestamp (set by server)
}
```

## 🔐 Security Notes

⚠️ **Current implementation is for demonstration only**

For production:
- Add HTTPS/WSS
- Implement JWT authentication
- Hash passwords (BCrypt)
- Add rate limiting
- Validate all inputs
- Add XSS protection
- Implement CSRF tokens

## 🌟 Future Enhancements

- [ ] Private messaging
- [ ] Multiple chat rooms
- [ ] User avatars
- [ ] Typing indicators
- [ ] Message reactions
- [ ] File uploads
- [ ] Message search
- [ ] User profiles
- [ ] Online/offline status
- [ ] Message read receipts

## 📚 Libraries Used

- **React 18.2.0** - UI framework
- **SockJS Client 1.6.1** - WebSocket with fallbacks
- **@stomp/stompjs 7.0.0** - STOMP protocol
- **Axios 1.2.0** - HTTP client

## 🎓 Learn More

- [Spring WebSocket Docs](https://docs.spring.io/spring-framework/docs/current/reference/html/web.html#websocket)
- [STOMP Protocol](https://stomp.github.io/)
- [SockJS Client](https://github.com/sockjs/sockjs-client)
- [React Hooks](https://react.dev/reference/react)

---

**Status:** ✅ ChatEngine.io removed, Socket.IO implemented
**Ready for:** Development and testing
