# Chat App - Quick Start Guide

## 🚀 Quick Setup

### Prerequisites
- Java 17 or higher
- Maven 3.6+
- Node.js 14+ and npm
- Chat Engine account (sign up at https://chatengine.io)

### Step 1: Get Chat Engine Credentials

1. Go to [chatengine.io](https://chatengine.io) and create an account
2. Create a new project
3. Copy your **Project ID** and **Private Key** from the dashboard

### Step 2: Configure Backend

1. Open `backend/src/main/resources/application.properties`
2. Replace the placeholders with your credentials:
   ```properties
   chat.engine.project-id=YOUR_PROJECT_ID_HERE
   chat.engine.private-key=YOUR_PRIVATE_KEY_HERE
   ```

### Step 3: Configure Frontend

1. Navigate to `frontend/` directory
2. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
3. Open `.env` and add your Project ID:
   ```
   REACT_APP_CHAT_ENGINE_PROJECT_ID=YOUR_PROJECT_ID_HERE
   ```

### Step 4: Start the Backend

```bash
cd backend
mvn clean install
mvn spring-boot:run
```

Backend will run on `http://localhost:8080`

### Step 5: Start the Frontend

```bash
cd frontend
npm install
npm start
```

Frontend will open automatically at `http://localhost:3000`

## ✅ Testing the Application

1. Open `http://localhost:3000` in your browser
2. Click "Sign up" and create a new account
3. Once logged in, you'll see the chat interface
4. Open another browser window in incognito mode and create another account
5. Start chatting between the two accounts!

## 📁 Project Structure

```
chat-app-clean/
├── backend/                    # Spring Boot REST API
│   ├── src/main/java/com/chatapp/
│   │   ├── ChatApplication.java           # Main application
│   │   ├── controller/
│   │   │   └── AuthController.java        # Authentication endpoints
│   │   └── model/
│   │       └── AuthRequest.java           # Request DTO
│   ├── src/main/resources/
│   │   └── application.properties         # Configuration
│   └── pom.xml                            # Maven dependencies
│
├── frontend/                   # React application
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── components/
│   │   │   ├── AuthPage.js                # Login/Signup page
│   │   │   ├── AuthPage.css
│   │   │   ├── ChatsPage.js               # Chat interface
│   │   │   └── ChatsPage.css
│   │   ├── App.js                         # Main component
│   │   ├── App.css
│   │   └── index.js                       # Entry point
│   ├── .env.example                       # Environment template
│   └── package.json                       # npm dependencies
│
└── README.md                   # Main documentation
```

## 🐛 Troubleshooting

### Backend Issues

**Port 8080 already in use:**
```properties
# Change port in application.properties
server.port=8081
```

**

Maven build fails:**
```bash
# Clear Maven cache and rebuild
mvn clean
rm -rf ~/.m2/repository
mvn install
```

### Frontend Issues

**npm install fails:**
```bash
# Clear npm cache
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

**CORS errors:**
- Make sure backend is running on port 8080
- Check `REACT_APP_API_URL` in `.env` matches your backend URL

## 🔧 Development Tips

### Hot Reload
- Backend: Use Spring Boot DevTools (already included)
- Frontend: npm start enables hot reload by default

### API Testing
Use the `/requests.rest` file (if using VS Code REST Client) or Postman:

**Login:**
```http
POST http://localhost:8080/api/auth/login
Content-Type: application/json

{
  "username": "testuser",
  "secret": "password123"
}
```

**Signup:**
```http
POST http://localhost:8080/api/auth/signup
Content-Type: application/json

{
  "username": "newuser",
  "secret": "password123",
  "email": "user@example.com",
  "first_name": "John",
  "last_name": "Doe"
}
```

## 📦 Building for Production

### Backend
```bash
cd backend
mvn clean package
java -jar target/chat-app-backend-1.0.0.jar
```

### Frontend
```bash
cd frontend
npm run build
# Deploy the 'build' folder to your hosting service
```

## 🎯 Features Checklist

- ✅ User registration
- ✅ User login
- ✅ Real-time chat
- ✅ Type-safe code (no Java raw types)
- ✅ Proper error handling
- ✅ Modern UI design
- ✅ Responsive layout
- ✅ Loading states
- ✅ Form validation

## 📝 License

MIT License - feel free to use this project for learning or production!

## 🙏 Credits

- Built with Spring Boot and React
- Powered by [Chat Engine](https://chatengine.io)
