# Chat Application - Universal HTTP Access Setup

## ✅ Configuration Complete!

The chat application has been configured to allow **universal HTTP access** for all users. This means anyone can access the chat application from any origin.

## 🚀 How to Run the Application

### Step 1: Start the Backend Server

The Spring Boot backend must be running on port 8080.

**Option A: Using Maven Wrapper (Recommended)**
```powershell
cd server-spring
$env:JAVA_HOME = "C:\Program Files\Java\jdk-21"
.\mvnw.cmd spring-boot:run
```

**Option B: Using Java directly (if JAR is built)**
```powershell
cd server-spring
java -jar target/server-spring-0.0.1-SNAPSHOT.jar
```

**Verify the server is running:**
- You should see: `Started ServerSpringApplication in X seconds`
- Server runs on: `http://localhost:8080`
- H2 Database Console: `http://localhost:8080/h2-console`

### Step 2: Open the Chat Application

**Option A: Open HTML file directly in browser**
1. Navigate to: `c:\Users\ragha\Downloads\fullstack-chat-main\`
2. Double-click `chat-app.html` to open in your default browser
3. Or right-click → Open with → Choose your browser

**Option B: Use file:// URL**
Open your browser and navigate to:
```
file:///c:/Users/ragha/Downloads/fullstack-chat-main/chat-app.html
```

**Option C: Serve via HTTP (for production-like testing)**
```powershell
# Using Python (if installed)
python -m http.server 3000

# Then open: http://localhost:3000/chat-app.html
```

## 📝 How to Use the Chat Application

### First Time Users:
1. Click "Sign up" link
2. Fill in:
   - Username (required)
   - Email (required)
   - First Name (required)
   - Last Name (required)
   - Password (required)
3. Click "Sign Up" button
4. You'll be automatically logged in and taken to the chat room

### Existing Users:
1. Enter your Username and Password
2. Click "Login" button
3. You'll be taken to the chat room

### In the Chat Room:
- Type messages in the input box at the bottom
- Click "Send" or press Enter to send messages
- You'll see when other users join or leave
- Your messages appear on the right (with gradient background)
- Other users' messages appear on the left (white background)
- Click "Logout" to return to the login screen

## 🔧 Technical Details

### Changes Made for Universal HTTP Access:

1. **WebSocketConfig.java**
   - Changed `setAllowedOriginPatterns()` from specific domains to `"*"`
   - This allows WebSocket connections from any origin

2. **UserController.java**
   - Added `@CrossOrigin(origins = "*")` at class level
   - This allows REST API calls from any origin

### Backend Endpoints:

- `POST /login` - User authentication
- `POST /signup` - User registration
- `GET /users/search/{query}` - Search users
- `WS /ws` - WebSocket endpoint for real-time chat

### Database:

- **Type:** H2 (embedded, file-based)
- **Location:** `./chat_db` (in server-spring directory)
- **Console:** http://localhost:8080/h2-console
  - JDBC URL: `jdbc:h2:file:./chat_db`
  - Username: `sa`
  - Password: (leave empty)

## 🌐 Sharing with Other Users

### Local Network Access:
1. Find your computer's IP address:
   ```powershell
   ipconfig
   # Look for IPv4 Address (e.g., 192.168.1.100)
   ```

2. Update `chat-app.html` line 340:
   ```javascript
   // Change from:
   const API_URL = 'http://localhost:8080';
   
   // To:
   const API_URL = 'http://YOUR_IP_ADDRESS:8080';
   // Example: const API_URL = 'http://192.168.1.100:8080';
   ```

3. Share the HTML file with other users on your network
4. They can open it directly in their browser

### Internet Access (Production):
For production deployment, you would need to:
1. Deploy the Spring Boot backend to a cloud server (AWS, Heroku, etc.)
2. Update the `API_URL` in `chat-app.html` to point to your server
3. Host the HTML file on a web server or CDN
4. Consider adding proper security (HTTPS, authentication tokens, etc.)

## 🛡️ Security Notes

⚠️ **IMPORTANT:** The current configuration allows connections from ANY origin (`*`). This is suitable for:
- Development and testing
- Local network usage
- Trusted environments

For production use, you should:
1. Restrict CORS to specific domains
2. Implement proper authentication (JWT tokens)
3. Use HTTPS for all connections
4. Add rate limiting
5. Implement proper session management

## 📊 Current Status

✅ Backend server is running on port 8080
✅ WebSocket connections allowed from all origins
✅ REST API endpoints accessible from all origins
✅ H2 database initialized and ready
✅ Chat application HTML ready to use

## 🐛 Troubleshooting

### "Connection error. Make sure the server is running."
- Verify the backend server is running on port 8080
- Check if another application is using port 8080
- Ensure firewall isn't blocking the connection

### "WebSocket connection error"
- Make sure the backend server started successfully
- Check browser console for detailed error messages
- Verify the API_URL in chat-app.html matches your server

### Database Issues
- Delete `chat_db.mv.db` and `chat_db.trace.db` files to reset
- Server will recreate the database on next startup

## 📞 Support

If you encounter any issues:
1. Check the server console for error messages
2. Check browser console (F12) for JavaScript errors
3. Verify all configuration steps were followed
4. Ensure Java 21 is installed and JAVA_HOME is set correctly
