# 💬 Boxbi Messenger - Real-Time Chat Application

A modern, full-stack real-time chat application built with Spring Boot, WebSocket, and vanilla JavaScript.

![Chat Demo](https://img.shields.io/badge/Status-Live-success)
![Java](https://img.shields.io/badge/Java-21-orange)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.2.1-green)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14-blue)

## 🌐 Live Demo

**Try it now:** [https://zoobichatapp.netlify.app/chat-realtime.html](https://zoobichatapp.netlify.app/chat-realtime.html)

## ✨ Features

- ⚡ **Real-time messaging** using WebSocket
- 👥 **Multiple users** can chat simultaneously
- 🔔 **Join/leave notifications**
- ⏰ **Message timestamps**
- 💾 **Persistent storage** with PostgreSQL
- 📱 **Responsive design** for all devices
- 🎨 **Modern UI** with gradient backgrounds
- 🔒 **Secure** HTTPS/WSS connections

## 🏗️ Architecture

```
Frontend (Netlify)  ←→  Backend (Render)  ←→  Database (PostgreSQL)
   HTML/CSS/JS           Spring Boot            Render PostgreSQL
   SockJS/STOMP          WebSocket/STOMP        JPA/Hibernate
```

## 🛠️ Technologies

### Backend

- **Java 21**
- **Spring Boot 3.2.1**
- **Spring WebSocket**
- **Spring Data JPA**
- **PostgreSQL**
- **Maven**
- **Docker**

### Frontend

- **HTML5**
- **CSS3**
- **Vanilla JavaScript**
- **SockJS 1.6.1**
- **STOMP.js 2.3.3**

### DevOps

- **Docker** - Containerization
- **GitHub** - Version control
- **Render** - Backend & database hosting
- **Netlify** - Frontend hosting

## 🚀 Quick Start

### Prerequisites

- Java 21
- Maven 3.9+
- PostgreSQL (or use H2 for local development)

### Local Development

1. **Clone the repository**

```bash
git clone https://github.com/zoobichata/fullstack-chat-main.git
cd fullstack-chat-main
```

1. **Run the backend**

```bash
cd server-spring
./mvnw spring-boot:run
```

1. **Open the frontend**

- Open `chat-realtime.html` in your browser
- Or serve it with a local server

1. **Start chatting!**

- Enter your name
- Send messages
- Open multiple browser tabs to test real-time messaging

## 📦 Deployment

### Backend (Render)

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Configure:
   - **Environment:** Docker
   - **Dockerfile Path:** `./Dockerfile`
   - **Root Directory:** (empty)

4. Add environment variables:

```
SERVER_PORT=8080
SPRING_DATASOURCE_URL=jdbc:postgresql://[HOST]/[DATABASE]
SPRING_DATASOURCE_USERNAME=[USERNAME]
SPRING_DATASOURCE_PASSWORD=[PASSWORD]
SPRING_DATASOURCE_DRIVER_CLASS_NAME=org.postgresql.Driver
SPRING_JPA_DATABASE_PLATFORM=org.hibernate.dialect.PostgreSQLDialect
```

### Frontend (Netlify)

1. Create a new site on Netlify
2. Connect your GitHub repository
3. Configure:
   - **Build Command:** (empty)
   - **Publish Directory:** `.`
   - **Branch:** `main`

4. Deploy!

## 📁 Project Structure

```
zoobi/
├── server-spring/              # Backend Spring Boot application
│   ├── src/
│   │   ├── main/
│   │   │   ├── java/          # Java source files
│   │   │   └── resources/     # Configuration files
│   │   └── test/              # Test files
│   └── pom.xml                # Maven dependencies
├── chat-realtime.html         # Main chat interface
├── chat-app.html              # Alternative chat UI
├── Dockerfile                 # Docker configuration
├── DEPLOYMENT_GUIDE.md        # Deployment instructions
├── PROJECT_REPORT.md          # Full project documentation
└── README.md                  # This file
```

## 🔧 Configuration

### Backend Configuration

Edit `server-spring/src/main/resources/application.properties`:

```properties
# Server Configuration
server.port=${SERVER_PORT:8080}

# Database Configuration
spring.datasource.url=${SPRING_DATASOURCE_URL:jdbc:h2:mem:chatdb}
spring.datasource.driverClassName=${SPRING_DATASOURCE_DRIVER_CLASS_NAME:org.h2.Driver}
spring.datasource.username=${SPRING_DATASOURCE_USERNAME:sa}
spring.datasource.password=${SPRING_DATASOURCE_PASSWORD:}
spring.h2.console.enabled=${SPRING_H2_CONSOLE_ENABLED:true}
spring.jpa.hibernate.ddl-auto=update
```

### Frontend Configuration

Update the WebSocket URL in `chat-realtime.html`:

```javascript
const socketUrl = isLocal 
    ? 'http://localhost:8080/ws' 
    : 'https://YOUR-BACKEND-URL.onrender.com/ws';
```

## 🧪 Testing

### Manual Testing

1. Open the app in multiple browser windows
2. Enter different usernames
3. Send messages and verify real-time delivery
4. Check join/leave notifications

### Automated Testing

```bash
cd server-spring
./mvnw test
```

## 📸 Screenshots

### Landing Page

![Landing Page](screenshots/landing_page.png)

### Chat Interface

![Chat Interface](screenshots/chat_interface.png)

### Multiple Users

![Multiple Users](screenshots/multiple_users.png)

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 👨‍💻 Author

**Raghav**

- GitHub: [@zoobichata](https://github.com/zoobichata)
- Website: [boxbi.online](https://boxbi.online)

## 🙏 Acknowledgments

- Spring Boot team for the excellent framework
- Render for free hosting
- Netlify for seamless deployment
- The open-source community

## 📚 Documentation

For detailed documentation, see:

- [PROJECT_REPORT.md](PROJECT_REPORT.md) - Complete project documentation
- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - Deployment instructions

## 🐛 Known Issues

- Messages are lost on server restart when using H2 (use PostgreSQL for persistence)
- Free tier on Render may have cold starts (~30 seconds)

## 🔮 Future Enhancements

- [ ] Private messaging
- [ ] File sharing
- [ ] Emoji support
- [ ] Typing indicators
- [ ] User authentication
- [ ] Chat rooms
- [ ] Message search
- [ ] Voice/video calls

## 📞 Support

If you have any questions or issues, please:

1. Check the [documentation](PROJECT_REPORT.md)
2. Open an [issue](https://github.com/zoobichata/fullstack-chat-main/issues)
3. Contact via email

---

**⭐ If you like this project, please give it a star!**

Made with ❤️ by Raghav
