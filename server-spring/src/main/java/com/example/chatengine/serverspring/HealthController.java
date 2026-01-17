package com.example.chatengine.serverspring;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {

    @GetMapping("/health")
    public String health() {
        return "Backend is running!";
    }

    @GetMapping("/")
    public String root() {
        return "Backend is running! Connect to /ws for WebSocket.";
    }
}
