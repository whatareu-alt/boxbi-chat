# 🤖 Zoobi - AI-Powered Real-Time Chat Application

A real-time chat application with user authentication, built with Spring Boot (backend) and vanilla HTML/CSS/JavaScript (frontend).

## ✨ Features

- 🔐 **User Authentication** - Secure login and signup
- 💬 **Real-time Messaging** - WebSocket-based instant messaging
- 👥 **Multi-user Support** - See when users join/leave
- 🎨 **Modern UI** - Beautiful gradient design with smooth animations
- 🗄️ **Persistent Storage** - H2 database for user data
- 🌐 **Universal HTTP Access** - Works from any origin (configured for all users)

## 🚀 Quick Start

### Option 1: Use the Startup Script (Easiest!)

1. **Double-click** `START_SERVER.bat` to start the backend server
2. **Double-click** `chat-app.html` to open the chat application
3. **Sign up** or **Login** and start chatting!

### Option 2: Manual Start

1. **Start the backend server:**
   ```powershell
   cd server-spring
   $env:JAVA_HOME = "C:\Program Files\Java\jdk-21"
   .\mvnw.cmd spring-boot:run
   ```

2. **Open Zoobi chat:**
   - Double-click `chat-app.html`, or
   - Open in browser: `file:///c:/Users/ragha/Downloads/fullstack-chat-main/chat-app.html`

3. **Create an account and start chatting!**

## 📋 Prerequisites

- **Java 21** - [Download here](https://www.oracle.com/java/technologies/downloads/#java21)
- **Modern web browser** - Chrome, Firefox, Edge, or Safari

## 📚 Documentation

- **[QUICK_START.txt](QUICK_START.txt)** - Quick reference card with all commands
- **[SETUP_GUIDE.md](SETUP_GUIDE.md)** - Comprehensive setup and configuration guide
- **[SOCKET_IO_README.md](SOCKET_IO_README.md)** - WebSocket implementation details

## 🏗️ Project Structure

```
zoobi-chat/
├── chat-app.html              # Zoobi chat interface (frontend)
├── START_SERVER.bat           # Easy server startup script
├── QUICK_START.txt            # Quick reference guide
├── SETUP_GUIDE.md            # Detailed setup instructions
├── server-spring/            # Spring Boot backend
│   ├── src/
│   │   └── main/
│   │       ├── java/
│   │       │   └── com/example/chatengine/serverspring/
│   │       │       ├── ChatController.java
│   │       │       ├── ChatMessage.java
│   │       │       ├── User.java
│   │       │       ├── UserController.java
│   │       │       ├── UserRepository.java
│   │       │       └── WebSocketConfig.java
│   │       └── resources/
│   │           └── application.properties
│   ├── pom.xml
│   └── mvnw.cmd
└── chat_db.*                 # H2 database files (auto-created)
```

## 🔧 Configuration

### Backend (Spring Boot)

- **Port:** 8080
- **Database:** H2 (embedded, file-based)
- **CORS:** Enabled for all origins (`*`)
- **WebSocket:** STOMP over SockJS

### Frontend (HTML)

- **API URL:** `http://localhost:8080` (line 340 in chat-app.html)
- **WebSocket:** Connects to `/ws` endpoint
- **Libraries:** SockJS, STOMP.js (loaded from CDN)

## 🌐 Sharing with Others

### Same Computer
Just share the `chat-app.html` file - it works out of the box!

### Local Network
1. Find your IP address: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
2. Edit `chat-app.html` line 340:
   ```javascript
   const API_URL = 'http://YOUR_IP_ADDRESS:8080';
   ```
3. Share the HTML file with others on your network

### Internet (Production)
See [SETUP_GUIDE.md](SETUP_GUIDE.md) for deploying Zoobi globally.

## 🎯 How to Use

### First Time Users
1. Click **"Sign up"** link
2. Fill in all required fields:
   - Username
   - Email
   - First Name
   - Last Name
   - Password
3. Click **"Sign Up"**
4. You'll be automatically logged in!

### Existing Users
1. Enter your **Username** and **Password**
2. Click **"Login"**

### In the Chat Room
- Type messages in the input box at the bottom
- Press **Enter** or click **"Send"** to send messages
- Your messages appear on the right (gradient background)
- Other users' messages appear on the left (white background)
- See notifications when users join or leave
- Click **"Logout"** to exit

## 🛠️ Technical Stack

### Backend
- **Framework:** Spring Boot 3.2.1
- **Language:** Java 21
- **Database:** H2 (embedded)
- **WebSocket:** Spring WebSocket with STOMP
- **Build Tool:** Maven

### Frontend
- **HTML5** - Structure
- **CSS3** - Styling with gradients and animations
- **JavaScript (ES6+)** - Logic and WebSocket handling
- **SockJS** - WebSocket fallback support
- **STOMP.js** - Messaging protocol

## 📊 API Endpoints

### REST API
- `POST /login` - User authentication
- `POST /signup` - User registration
- `GET /users/search/{query}` - Search users

### WebSocket
- `WS /ws` - WebSocket connection endpoint
- `/app/chat.addUser` - Join chat room
- `/app/chat.sendMessage` - Send message
- `/topic/public` - Public message subscription

## 🗄️ Database

### H2 Console Access
- **URL:** http://localhost:8080/h2-console
- **JDBC URL:** `jdbc:h2:file:./chat_db`
- **Username:** `sa`
- **Password:** (leave empty)

### User Table Schema
```sql
CREATE TABLE user (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    secret VARCHAR(255)
);
```

## 🐛 Troubleshooting

### Server won't start
- **Check Java installation:** `java -version`
- **Verify JAVA_HOME:** Should point to JDK 21
- **Port conflict:** Another app might be using port 8080

### Can't connect to server
- **Verify server is running:** Look for "Started ServerSpringApplication"
- **Check firewall:** Allow connections on port 8080
- **Verify API_URL:** Should match your server address

### WebSocket errors
- **Check browser console:** Press F12 to see detailed errors
- **Verify CORS settings:** Should allow your origin
- **Try different browser:** Some browsers have stricter WebSocket policies

### Database issues
- **Reset database:** Delete `chat_db.mv.db` and `chat_db.trace.db` files
- **Restart server:** Database will be recreated automatically

## ⚠️ Security Notice

**Current Configuration:** The application is configured to accept connections from **all origins** (`*`). This is suitable for:
- ✅ Development and testing
- ✅ Local network usage
- ✅ Trusted environments

**For Production Use:**
- ❌ Restrict CORS to specific domains
- ❌ Implement HTTPS
- ❌ Add JWT token authentication
- ❌ Implement rate limiting
- ❌ Add input validation and sanitization
- ❌ Use secure session management
- ❌ Add password hashing (bcrypt)

## 📝 License

This project is for educational and demonstration purposes.

## 🤝 Contributing

Feel free to fork, modify, and use this project for your own purposes!

## 📞 Support

If you encounter any issues:
1. Check the [SETUP_GUIDE.md](SETUP_GUIDE.md)
2. Review the [QUICK_START.txt](QUICK_START.txt)
3. Check server console for error messages
4. Check browser console (F12) for JavaScript errors

## 🎉 Enjoy Chatting!

Your chat application is ready to use! Start the server, open the app, and start chatting with friends!

---

**Last Updated:** January 15, 2026
**Version:** 1.0.0
**Status:** ✅ Fully Functional - Universal HTTP Access Enabled
