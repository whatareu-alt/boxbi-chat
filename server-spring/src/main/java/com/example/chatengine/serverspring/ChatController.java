package com.example.chatengine.serverspring;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.owasp.encoder.Encode;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.stereotype.Controller;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.util.Objects;

@Controller
public class ChatController {

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @MessageMapping("/chat.sendMessage")
    @SendTo("/topic/public")
    public ChatMessage sendMessage(@Valid @Payload @NotNull ChatMessage chatMessage) {
        // Sanitize message content to prevent XSS attacks
        if (chatMessage.getContent() != null) {
            chatMessage.setContent(Encode.forHtml(chatMessage.getContent()));
        }
        if (chatMessage.getSender() != null) {
            chatMessage.setSender(Encode.forHtml(chatMessage.getSender()));
        }
        chatMessage.setTimestamp(System.currentTimeMillis());
        return chatMessage;
    }

    @MessageMapping("/chat.private")
    public void sendPrivateMessage(@Valid @Payload @NotNull ChatMessage chatMessage) {
        // Sanitize message content
        if (chatMessage.getContent() != null) {
            String sanitized = Encode.forHtml(chatMessage.getContent());
            chatMessage.setContent(Objects.requireNonNullElse(sanitized, ""));
        }
        if (chatMessage.getSender() != null) {
            String sanitized = Encode.forHtml(chatMessage.getSender());
            chatMessage.setSender(Objects.requireNonNullElse(sanitized, "Anonymous"));
        }
        chatMessage.setTimestamp(System.currentTimeMillis());

        // Send to specific user
        if (chatMessage.getRecipient() != null) {
            messagingTemplate.convertAndSendToUser(
                    chatMessage.getRecipient(),
                    "/queue/private",
                    chatMessage);

            // Also send back to sender so they see it in their chat history
            if (chatMessage.getSender() != null) {
                messagingTemplate.convertAndSendToUser(
                        chatMessage.getSender(),
                        "/queue/private",
                        chatMessage);
            }
        }
    }

    @MessageMapping("/chat.addUser")
    @SendTo("/topic/public")
    public ChatMessage addUser(@Valid @Payload @NotNull ChatMessage chatMessage,
            @NotNull SimpMessageHeaderAccessor headerAccessor) {
        // Sanitize username
        String sanitizedUsername = chatMessage.getSender() != null
                ? Encode.forHtml(chatMessage.getSender())
                : "Anonymous";
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
