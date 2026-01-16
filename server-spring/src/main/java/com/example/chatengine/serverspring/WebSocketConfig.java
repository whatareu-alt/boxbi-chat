package com.example.chatengine.serverspring;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.lang.NonNull;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(@NonNull MessageBrokerRegistry config) {
        // Enable a simple in-memory message broker
        config.enableSimpleBroker("/topic", "/queue");
        // Prefix for messages FROM client TO server
        config.setApplicationDestinationPrefixes("/app");
        // Prefix for private user messages
        config.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(@NonNull StompEndpointRegistry registry) {
        // Register the /ws endpoint for WebSocket connections
        // Allow all origins for universal HTTP access
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns(
                        "*",
                        "https://zoobichatapp.netlify.app",
                        "https://boxbi.online",
                        "https://www.boxbi.online",
                        "http://localhost:*",
                        "https://*.netlify.app")
                .setHandshakeHandler(new CustomHandshakeHandler())
                .withSockJS();
    }
}
