# Boxbi Messenger - System Architecture Diagram

```mermaid
graph TD
    %% Styling
    classDef frontend fill:#e1f5fe,stroke:#01579b,stroke-width:2px,color:#01579b;
    classDef backend fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px,color:#2e7d32;
    classDef db fill:#fff3e0,stroke:#ef6c00,stroke-width:2px,color:#ef6c00;
    classDef user fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px,color:#7b1fa2;

    %% Nodes
    User((User / Browser)):::user
    
    subgraph Frontend_Netlify [Frontend Hosted on Netlify]
        UI[HTML5 / CSS3 Interface]:::frontend
        JS[Vanilla JS Logic]:::frontend
        Stomp[SockJS / Stomp Client]:::frontend
    end

    subgraph Backend_Render [Backend Hosted on Render]
        Controller[Spring Boot Controller]:::backend
        Broker[Message Broker]:::backend
        JPA[Spring Data JPA]:::backend
    end

    subgraph Database_Layer [Data Layer]
        Postgres[(PostgreSQL Database)]:::db
    end

    %% Connections
    User <-->|HTTPS Access| UI
    UI --> JS
    JS --> Stomp
    Stomp <-->|WebSocket Connection (WSS)| Controller
    Controller <-->|Publish/Subscribe| Broker
    Controller -->|Save/Load Data| JPA
    JPA <-->|JDBC Connection| Postgres

```

## Diagram Explanation

1. **User Layer:** The end-user accesses the application via a web browser.
2. **Frontend (Netlify):**
   - Uses **HTML/CSS** for the visual interface.
   - **Vanilla JS** handles user interactions.
   - **SockJS & STOMP** manage the real-time connection.
3. **Backend (Render):**
   - **Spring Boot** manages the application logic.
   - **Message Broker** handles internal routing of chat messages.
   - **JPA** manages data persistence.
4. **Database (PostgreSQL):** Stores user data and chat history permanently.
