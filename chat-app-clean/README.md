# Chat Application - Clean Implementation

A full-stack chat application with Spring Boot backend and React frontend, integrated with Chat Engine API.

## Project Structure

```
chat-app-clean/
├── backend/           # Spring Boot REST API
├── frontend/          # React client application
└── README.md         # This file
```

## Features

- ✅ User authentication (Login/Signup)
- ✅ Real-time chat powered by Chat Engine
- ✅ Clean, type-safe code
- ✅ Proper error handling
- ✅ RESTful API design

## Backend (Spring Boot)

### Prerequisites
- Java 11+ 
- Maven 3.6+

### Setup
1. Navigate to the backend directory
2. Update `application.properties` with your Chat Engine credentials
3. Run: `mvn clean install`
4. Start: `mvn spring-boot:run`

The backend will run on `http://localhost:8080`

### API Endpoints

#### POST /api/auth/login
Login with existing credentials
```json
{
  "username": "string",
  "secret": "string"
}
```

#### POST /api/auth/signup
Create a new user account
```json
{
  "username": "string",
  "secret": "string",
  "email": "string",
  "first_name": "string",
  "last_name": "string"
}
```

## Frontend (React)

### Prerequisites
- Node.js 14+
- npm or yarn

### Setup
1. Navigate to the frontend directory
2. Run: `npm install`
3. Create `.env` file with your Chat Engine Project ID
4. Start: `npm start`

The frontend will run on `http://localhost:3000`

## Configuration

### Chat Engine Setup
1. Sign up at [chatengine.io](https://chatengine.io)
2. Create a new project
3. Copy your Project ID and Private Key
4. Add them to the configuration files

### Backend Configuration
File: `backend/src/main/resources/application.properties`
```properties
chat.engine.project-id=your-project-id
chat.engine.private-key=your-private-key
```

### Frontend Configuration
File: `frontend/.env`
```
REACT_APP_API_URL=http://localhost:8080/api
REACT_APP_CHAT_ENGINE_PROJECT_ID=your-project-id
```

## Development

### Running Both Services
1. Start the backend: `cd backend && mvn spring-boot:run`
2. Start the frontend: `cd frontend && npm start`
3. Open browser to `http://localhost:3000`

## Code Quality

This clean implementation includes:
- ✅ Proper type safety (no raw types)
- ✅ Comprehensive error handling
- ✅ Null safety checks
- ✅ Clean code structure
- ✅ Best practices followed
- ✅ No deprecated methods

## License

MIT License
