package com.example.chatengine.serverspring;

import org.springframework.http.server.ServerHttpRequest;
import org.springframework.lang.NonNull;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.support.DefaultHandshakeHandler;

import java.io.UnsupportedEncodingException;
import java.net.URLDecoder;
import java.security.Principal;
import java.util.Map;

public class CustomHandshakeHandler extends DefaultHandshakeHandler {
    @Override
    protected Principal determineUser(@NonNull ServerHttpRequest request, @NonNull WebSocketHandler wsHandler,
            @NonNull Map<String, Object> attributes) {
        // Parse username from query params (e.g., /ws?username=Alex)
        String query = request.getURI().getQuery();
        String username = null;

        System.out.println("🔌 WebSocket Handshake - Query: " + query);

        if (query != null && query.contains("username=")) {
            String[] params = query.split("&");
            for (String param : params) {
                if (param.startsWith("username=")) {
                    try {
                        username = URLDecoder.decode(param.split("=")[1], "UTF-8");
                        System.out.println("✅ Extracted username: " + username);
                    } catch (UnsupportedEncodingException e) {
                        username = param.split("=")[1];
                        System.err.println("⚠️ URL decode failed, using raw: " + username);
                    }
                    break;
                }
            }
        }

        if (username == null || username.isEmpty()) {
            // Fallback for anonymous or connection without username
            username = "Anonymous";
            System.out.println("⚠️ No username found, using: " + username);
        }

        System.out.println("👤 Setting WebSocket Principal: " + username);
        return new StompPrincipal(username);
    }
}
