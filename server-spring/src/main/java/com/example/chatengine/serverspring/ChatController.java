package com.example.chatengine.serverspring;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.stereotype.Controller;

@Controller
public class ChatController {

    @MessageMapping("/chat.sendMessage")
    @SendTo("/topic/public")
    public ChatMessage sendMessage(@Payload ChatMessage chatMessage) {
        chatMessage.setTimestamp(System.currentTimeMillis());
        return chatMessage;
    }

    @MessageMapping("/chat.addUser")
    @SendTo("/topic/public")
    public ChatMessage addUser(@Payload ChatMessage chatMessage,
            SimpMessageHeaderAccessor headerAccessor) {
        // Add username in web socket session
        var sessionAttributes = headerAccessor.getSessionAttributes();
        if (sessionAttributes != null) {
            sessionAttributes.put("username", chatMessage.getSender());
        }
        chatMessage.setType("JOIN");
        chatMessage.setTimestamp(System.currentTimeMillis());
        return chatMessage;
    }
}
