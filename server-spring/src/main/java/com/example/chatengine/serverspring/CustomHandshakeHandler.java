package com.example.chatengine.serverspring;

import com.example.chatengine.serverspring.security.JwtUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.support.DefaultHandshakeHandler;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.security.Principal;
import java.util.Map;

@Component
public class CustomHandshakeHandler extends DefaultHandshakeHandler {

    private static final Logger log = LoggerFactory.getLogger(CustomHandshakeHandler.class);

    private final JwtUtil jwtUtil;

    public CustomHandshakeHandler(JwtUtil jwtUtil) {
        this.jwtUtil = jwtUtil;
    }

    @Override
    protected Principal determineUser(@NonNull ServerHttpRequest request, @NonNull WebSocketHandler wsHandler,
            @NonNull Map<String, Object> attributes) {
        // The identity is taken from a signed JWT (passed as ?token=...), NOT from the username
        // query param. Returning null leaves the connection unauthenticated; message handlers
        // reject unauthenticated principals.
        String token = queryParam(request.getURI().getQuery(), "token");
        if (token == null || token.isBlank()) {
            log.warn("WebSocket handshake rejected: missing token");
            return null;
        }

        try {
            String username = jwtUtil.extractUsername(token);
            if (username == null || !jwtUtil.validateToken(token, username)) {
                log.warn("WebSocket handshake rejected: invalid token");
                return null;
            }
            return new StompPrincipal(username);
        } catch (Exception e) {
            log.warn("WebSocket handshake rejected: token validation failed ({})", e.getMessage());
            return null;
        }
    }

    /** Extracts a single query-string parameter value, URL-decoded. */
    private static String queryParam(String query, String key) {
        if (query == null) {
            return null;
        }
        for (String param : query.split("&")) {
            int eq = param.indexOf('=');
            if (eq > 0 && param.substring(0, eq).equals(key)) {
                return URLDecoder.decode(param.substring(eq + 1), StandardCharsets.UTF_8);
            }
        }
        return null;
    }
}
