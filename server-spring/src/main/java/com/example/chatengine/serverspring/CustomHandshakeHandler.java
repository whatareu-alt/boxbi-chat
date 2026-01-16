package com.example.chatengine.serverspring;

import org.springframework.http.server.ServerHttpRequest;
import org.springframework.lang.NonNull;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.support.DefaultHandshakeHandler;

import java.security.Principal;
import java.util.Map;

public class CustomHandshakeHandler extends DefaultHandshakeHandler {
    @Override
    protected Principal determineUser(@NonNull ServerHttpRequest request, @NonNull WebSocketHandler wsHandler,
            @NonNull Map<String, Object> attributes) {
        // Parse username from query params (e.g., /ws?username=Alex)
        String query = request.getURI().getQuery();
        String username = null;

        if (query != null && query.contains("username=")) {
            String[] params = query.split("&");
            for (String param : params) {
                if (param.startsWith("username=")) {
                    username = param.split("=")[1];
                    break;
                }
            }
        }

        if (username == null) {
            // Fallback for anonymous or connection without username
            username = "Anonymous";
        }

        return new StompPrincipal(username);
    }
}
