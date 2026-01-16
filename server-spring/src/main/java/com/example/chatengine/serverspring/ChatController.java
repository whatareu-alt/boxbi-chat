package com.example.chatengine.serverspring;

import jakarta.validation.Valid;
import org.owasp.encoder.Encode;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.stereotype.Controller;

@Controller
public class ChatController {

    @MessageMapping("/chat.sendMessage")
    @SendTo("/topic/public")
    public ChatMessage sendMessage(@Valid @Payload ChatMessage chatMessage) {
        // Sanitize message content to prevent XSS attacks
        chatMessage.setContent(Encode.forHtml(chatMessage.getContent()));
        chatMessage.setSender(Encode.forHtml(chatMessage.getSender()));
        chatMessage.setTimestamp(System.currentTimeMillis());
        return chatMessage;
    }

    @MessageMapping("/chat.addUser")
    @SendTo("/topic/public")
    public ChatMessage addUser(@Valid @Payload ChatMessage chatMessage,
            SimpMessageHeaderAccessor headerAccessor) {
        // Sanitize username
        String sanitizedUsername = Encode.forHtml(chatMessage.getSender());
        chatMessage.setSender(sanitizedUsername);

        // Add username in web socket session
        var sessionAttributes = headerAccessor.getSessionAttributes();
        if (sessionAttributes != null) {
            sessionAttributes.put("username", sanitizedUsername);
        }
        chatMessage.setType("JOIN");
        chatMessage.setTimestamp(System.currentTimeMillis());
        return chatMessage;
    }
}
