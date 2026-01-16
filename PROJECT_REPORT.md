# Real-Time Chat Application - Boxbi Messenger

## College Project Documentation

**Project Name:** Boxbi Messenger - Real-Time Chat Application  
**Student Name:** [Your Name]  
**Roll Number:** [Your Roll Number]  
**Department:** [Your Department]  
**Academic Year:** 2025-2026  
**Submitted To:** [Professor Name]

---

## 📋 Table of Contents

1. [Abstract](#1-abstract)
2. [Introduction](#2-introduction)
3. [System Architecture](#3-system-architecture)
4. [Technologies Used](#4-technologies-used)
5. [Features](#5-features)
6. [Development Process](#6-development-process)
7. [Deployment](#7-deployment)
8. [Screenshots](#8-screenshots)
9. [Challenges & Solutions](#9-challenges--solutions)
10. [Future Enhancements](#10-future-enhancements)
11. [Conclusion](#11-conclusion)
12. [References](#12-references)

---

## 1. Abstract

This project presents a **full-stack real-time chat application** built using modern web technologies. The application enables multiple users to communicate in real-time through WebSocket connections. The system consists of a **Spring Boot backend** deployed on Render using Docker, a **vanilla JavaScript frontend** hosted on Netlify, and a **PostgreSQL database** for persistent data storage.

**Key Highlights:**

- Real-time bidirectional communication using WebSockets
- Scalable microservices architecture
- Cloud deployment with CI/CD integration
- Responsive and modern UI design
- Production-ready with persistent storage

**Live Demo:** <https://boxbi-messenger.netlify.app/chat-realtime.html>

---

## 2. Introduction

### 2.1 Problem Statement

In today's digital age, real-time communication is essential for collaboration, social interaction, and business operations. Traditional HTTP-based communication has limitations in delivering instant updates. This project addresses the need for a lightweight, scalable, and user-friendly real-time chat platform.

### 2.2 Objectives

1. Build a real-time messaging system using WebSocket technology
2. Implement a RESTful backend with Spring Boot
3. Design a responsive and intuitive user interface
4. Deploy the application to cloud platforms for global accessibility
5. Ensure data persistence using a relational database
6. Follow industry-standard development practices

### 2.3 Scope

The application supports:

- Multiple concurrent users
- Real-time message delivery
- User join/leave notifications
- Message timestamps
- Persistent chat history
- Cross-platform compatibility (web browsers)

---

## 3. System Architecture

### 3.1 High-Level Architecture

```text
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│                 │         │                  │         │                 │
│  Frontend       │◄───────►│  Backend         │◄───────►│  PostgreSQL     │
│  (Netlify)      │  WSS    │  (Render)        │  JDBC   │  Database       │
│  HTML/CSS/JS    │         │  Spring Boot     │         │  (Render)       │
│                 │         │  WebSocket       │         │                 │
└─────────────────┘         └──────────────────┘         └─────────────────┘
```

### 3.2 Component Breakdown

#### Frontend Layer

- **Technology:** Vanilla JavaScript, HTML5, CSS3
- **Libraries:** SockJS, STOMP.js
- **Hosting:** Netlify (CDN)
- **Responsibilities:**
  - User interface rendering
  - WebSocket client connection
  - Message sending/receiving
  - Real-time UI updates

#### Backend Layer

- **Framework:** Spring Boot 3.2.1
- **Java Version:** 21
- **Key Components:**
  - WebSocket Configuration
  - Message Broker (STOMP)
  - User Controller
  - Entity Models
- **Hosting:** Render (Docker Container)

#### Database Layer

- **Database:** PostgreSQL 14
- **ORM:** Hibernate/JPA
- **Hosting:** Render PostgreSQL
- **Schema:**
  - Users table
  - Messages table (future enhancement)

### 3.3 Communication Flow

1. **User Connects:**
   - Frontend establishes WebSocket connection via SockJS
   - STOMP protocol handles message routing
   - User subscribes to `/topic/public` channel

2. **Message Sending:**
   - User types message and clicks send
   - Frontend sends message to `/app/chat.sendMessage`
   - Backend broadcasts to all subscribers

3. **Message Receiving:**
   - Backend publishes to `/topic/public`
   - All connected clients receive the message
   - Frontend updates UI in real-time

---

## 4. Technologies Used

### 4.1 Frontend Technologies

| Technology | Version | Purpose |
| :--- | :--- | :--- |
| HTML5 | - | Structure and markup |
| CSS3 | - | Styling and animations |
| JavaScript (ES6+) | - | Client-side logic |
| SockJS | 1.6.1 | WebSocket fallback |
| STOMP.js | 2.3.3 | Messaging protocol |

### 4.2 Backend Technologies

| Technology | Version | Purpose |
| :--- | :--- | :--- |
| Java | 21 | Programming language |
| Spring Boot | 3.2.1 | Application framework |
| Spring WebSocket | 6.1.2 | WebSocket support |
| Spring Data JPA | 3.2.1 | Database abstraction |
| Hibernate | 6.4.1 | ORM framework |
| Maven | 3.9.6 | Build tool |
| PostgreSQL Driver | 42.6.0 | Database connectivity |

### 4.3 DevOps & Deployment

| Tool | Purpose |
| :--- | :--- |
| Docker | Containerization |
| Git | Version control |
| GitHub | Code repository |
| Render | Backend & database hosting |
| Netlify | Frontend hosting |

---

## 5. Features

### 5.1 Core Features

✅ **Real-Time Messaging**

- Instant message delivery using WebSocket
- No page refresh required
- Bidirectional communication

✅ **User Management**

- Username-based identification
- Join/leave notifications
- Avatar generation with initials

✅ **Message Features**

- Timestamps for each message
- Sender identification
- Message history

✅ **User Interface**

- Modern gradient design
- Responsive layout
- Smooth animations
- Connection status indicator

### 5.2 Technical Features

✅ **Scalability**

- Stateless backend design
- Horizontal scaling capability
- Cloud-native architecture

✅ **Reliability**

- Persistent database storage
- Automatic reconnection
- Error handling

✅ **Security**

- HTTPS/WSS encryption
- CORS configuration
- Environment variable management

---

## 6. Development Process

### 6.1 Phase 1: Planning & Design (Week 1)

**Activities:**

- Requirement analysis
- Technology stack selection
- Architecture design
- UI/UX wireframing

**Deliverables:**

- System architecture diagram
- Database schema
- UI mockups

### 6.2 Phase 2: Backend Development (Week 2-3)

#### Step 1: Project Setup

```bash
# Initialize Spring Boot project
spring init --dependencies=web,websocket,data-jpa,postgresql
```

#### Step 2: WebSocket Configuration

- Created `WebSocketConfig.java`
- Configured STOMP endpoints
- Set up message broker

#### Step 3: Message Handling

- Implemented `ChatController.java`
- Created message DTOs
- Added user management

#### Step 4: Database Integration

- Configured PostgreSQL connection
- Created JPA entities
- Set up repositories

### 6.3 Phase 3: Frontend Development (Week 3-4)

#### Step 1: HTML Structure

- Created semantic HTML layout
- Implemented form elements
- Added message containers

#### Step 2: CSS Styling

- Designed gradient backgrounds
- Created responsive layouts
- Added animations

#### Step 3: JavaScript Logic

- Implemented WebSocket client
- Created message handlers
- Added UI update functions

### 6.4 Phase 4: Integration & Testing (Week 4)

**Integration Steps:**

1. Connected frontend to backend WebSocket
2. Tested message flow
3. Verified database persistence
4. Cross-browser testing

**Testing Performed:**

- Unit testing (backend)
- Integration testing
- User acceptance testing
- Performance testing

### 6.5 Phase 5: Deployment (Week 5)

**Backend Deployment (Render):**

```dockerfile
# Multi-stage Docker build
FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /app
COPY server-spring/pom.xml .
COPY server-spring/src ./src
RUN mvn clean package -DskipTests

FROM eclipse-temurin:21-jdk-jammy
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

**Frontend Deployment (Netlify):**

- Connected GitHub repository
- Configured build settings
- Deployed static files

**Database Setup (Render PostgreSQL):**

- Created PostgreSQL instance
- Configured connection pooling
- Set up environment variables

---

## 7. Deployment

### 7.1 Backend Deployment on Render

**Configuration:**

```yaml
Environment: Docker
Dockerfile Path: ./Dockerfile
Root Directory: (empty)
Instance Type: Free
```

**Environment Variables:**

```properties
SERVER_PORT=8080
SPRING_DATASOURCE_URL=jdbc:postgresql://dpg-d5ktua9r0fns738qgob0-a/boxbi_messenger_db
SPRING_DATASOURCE_USERNAME=boxbi_messenger_db_user
SPRING_DATASOURCE_PASSWORD=8zxR2m76y5sNjpyBTRgZRJ7rwLvoCyuM
SPRING_DATASOURCE_DRIVER_CLASS_NAME=org.postgresql.Driver
SPRING_JPA_DATABASE_PLATFORM=org.hibernate.dialect.PostgreSQLDialect
```

**Deployment URL:** <https://fullstack-chat-main-j598.onrender.com>

### 7.2 Frontend Deployment on Netlify

**Configuration:**

```yaml
Build Command: (empty)
Publish Directory: .
Branch: main
```

**Deployment URL:** <https://boxbi-messenger.netlify.app>

### 7.3 Database Configuration

**PostgreSQL Instance:**

- Provider: Render
- Version: PostgreSQL 14
- Storage: 1 GB (Free tier)
- Region: US East

**Connection Details:**

```yaml
Host: dpg-d5ktua9r0fns738qgob0-a
Database: boxbi_messenger_db
User: boxbi_messenger_db_user
```

---

## 8. Screenshots

### 8.1 Landing Page

![Landing Page](screenshots/landing_page.png)
*User enters their name to join the chat*

### 8.2 Chat Interface

![Chat Interface](screenshots/chat_interface.png)
*Real-time messaging with timestamps and user avatars*

### 8.3 Multiple Users

![Multiple Users](screenshots/multiple_users.png)
*Multiple users chatting simultaneously*

### 8.4 Mobile View

![Mobile View](screenshots/mobile_view.png)
*Responsive design on mobile devices*

---

## 9. Challenges & Solutions

### Challenge 1: WebSocket Connection Issues

**Problem:** Initial WebSocket connections were failing due to CORS restrictions.

**Solution:**

- Configured `WebSocketConfig` with proper allowed origins
- Added SockJS fallback for browsers without WebSocket support
- Implemented connection retry logic

```java
registry.addEndpoint("/ws")
    .setAllowedOriginPatterns(
        "https://boxbi-messenger.netlify.app",
        "http://localhost:*"
    )
    .withSockJS();
```

### Challenge 2: Database Connection in Production

**Problem:** Application couldn't connect to PostgreSQL on Render.

**Solution:**

- Used environment variables for database credentials
- Configured proper JDBC URL format
- Added PostgreSQL driver dependency

### Challenge 3: Real-Time Message Delivery

**Problem:** Messages were not appearing instantly for all users.

**Solution:**

- Implemented STOMP message broker
- Used topic-based subscription model
- Optimized message serialization

### Challenge 4: Deployment Configuration

**Problem:** Docker build failing on Render.

**Solution:**

- Created multi-stage Dockerfile
- Optimized Maven build process
- Configured proper Java version

---

## 10. Future Enhancements

### 10.1 Short-Term Enhancements

1. **Private Messaging:** One-on-one chat functionality
2. **File Sharing:** Upload and share images/documents
3. **Emoji Support:** Rich text messaging
4. **Typing Indicators:** Show when users are typing
5. **Read Receipts:** Message delivery confirmation

### 10.2 Long-Term Enhancements

1. **User Authentication:** Login/signup with JWT
2. **Chat Rooms:** Multiple topic-based channels
3. **Message Search:** Full-text search capability
4. **Voice/Video Calls:** WebRTC integration
5. **Mobile Apps:** Native iOS/Android applications
6. **AI Chatbot:** Integrate AI assistant
7. **Message Encryption:** End-to-end encryption
8. **Analytics Dashboard:** Usage statistics

---

## 11. Conclusion

This project successfully demonstrates the implementation of a **production-ready real-time chat application** using modern web technologies. The application showcases:

✅ **Technical Proficiency:**

- Full-stack development skills
- Cloud deployment expertise
- Database management
- Real-time communication protocols

✅ **Best Practices:**

- Clean code architecture
- Version control with Git
- Environment-based configuration
- Containerization with Docker

✅ **Real-World Application:**

- Deployed on cloud platforms
- Accessible globally via HTTPS
- Scalable architecture
- Production-grade reliability

The project has been a valuable learning experience in building distributed systems, working with WebSocket technology, and deploying applications to cloud platforms. The skills acquired during this project are directly applicable to modern software development roles.

---

## 12. References

### Documentation

1. Spring Boot Documentation - <https://spring.io/projects/spring-boot>
2. Spring WebSocket Guide - <https://spring.io/guides/gs/messaging-stomp-websocket>
3. SockJS Client - <https://github.com/sockjs/sockjs-client>
4. STOMP Protocol - <https://stomp.github.io/>
5. PostgreSQL Documentation - <https://www.postgresql.org/docs/>

### Tutorials & Articles

1. "Building Real-Time Applications with Spring Boot" - Baeldung
2. "WebSocket vs HTTP" - Mozilla Developer Network
3. "Docker Best Practices" - Docker Official Docs
4. "Deploying Spring Boot to Render" - Render Documentation

### Tools & Platforms

1. Render - <https://render.com>
2. Netlify - <https://netlify.com>
3. GitHub - <https://github.com>
4. Maven Central Repository - <https://mvnrepository.com>

---

## Appendix

### A. Project Structure

```text
boxbi-messenger/
├── server-spring/
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/
│   │   │   │   └── com/example/chatengine/serverspring/
│   │   │   │       ├── ServerSpringApplication.java
│   │   │   │       ├── WebSocketConfig.java
│   │   │   │       ├── ChatController.java
│   │   │   │       ├── ChatMessage.java
│   │   │   │       ├── User.java
│   │   │   │       └── UserRepository.java
│   │   │   └── resources/
│   │   │       └── application.properties
│   │   └── test/
│   └── pom.xml
├── chat-realtime.html
├── Dockerfile
├── DEPLOYMENT_GUIDE.md
└── README.md
```

### B. Environment Variables Reference

See `.env` file for complete list of environment variables used in development and production.

### C. Git Repository

**GitHub:** <https://github.com/zoobichata/boxbi-messenger>

### D. Live URLs

- **Frontend:** <https://boxbi-messenger.netlify.app/chat-realtime.html>
- **Backend:** <https://boxbi-messenger-backend.onrender.com>
- **Custom Domain:** <https://boxbi.online> (optional)

---

**Project Completed:** January 16, 2026  
**Total Development Time:** 5 weeks  
**Lines of Code:** ~1,500  
**Technologies Mastered:** 10+

---

*This project report was prepared as part of the academic curriculum and demonstrates practical application of software engineering principles.*
