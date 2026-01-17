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
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.http.ResponseEntity;

import java.util.Objects;
import java.util.List;

@RestController
@Controller
@CrossOrigin(origins = {
        "https://chatappboxbi.netlify.app",
        "https://zoobichatapp.netlify.app",
        "https://boxbi.online",
        "https://www.boxbi.online",
        "https://boxmsg.netlify.app",
        "http://localhost:*",
        "http://127.0.0.1:*",
        "http://localhost:5500",
        "https://*.netlify.app"
})
public class ChatController {

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private MessageRepository messageRepository;

    @Autowired
    private FriendRequestRepository friendRequestRepository;

    @Autowired
    private GroupMemberRepository groupMemberRepository;

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
        System.out.println("\n=== 📨 PRIVATE MESSAGE RECEIVED ===");
        System.out.println("From: " + chatMessage.getSender());
        System.out.println("To: " + chatMessage.getRecipient());
        System.out.println("Content: " + chatMessage.getContent());

        // Check if users are friends before allowing message
        boolean areFriends = friendRequestRepository.areFriends(
                chatMessage.getSender(),
                chatMessage.getRecipient());

        if (!areFriends) {
            System.out.println("⚠️ Message BLOCKED: Users are not friends");
            return; // Don't send message if not friends
        }

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

        // Save message to database for persistence
        try {
            messageRepository.save(chatMessage);
            System.out.println("💾 Message saved to database");
        } catch (Exception e) {
            System.err.println("❌ Error saving message to database: " + e.getMessage());
            e.printStackTrace();
        }

        // Send to specific user
        if (chatMessage.getRecipient() != null) {
            try {
                System.out.println("→ Sending to recipient: " + chatMessage.getRecipient());
                messagingTemplate.convertAndSendToUser(
                        chatMessage.getRecipient(),
                        "/queue/private",
                        chatMessage);
                System.out.println("✅ Sent to recipient successfully");
            } catch (Exception e) {
                System.err.println("❌ Error sending to recipient: " + e.getMessage());
                e.printStackTrace();
            }

            // Also send back to sender so they see it in their chat history
            if (chatMessage.getSender() != null) {
                try {
                    System.out.println("← Sending back to sender: " + chatMessage.getSender());
                    messagingTemplate.convertAndSendToUser(
                            chatMessage.getSender(),
                            "/queue/private",
                            chatMessage);
                    System.out.println("✅ Sent to sender successfully");
                } catch (Exception e) {
                    System.err.println("❌ Error sending to sender: " + e.getMessage());
                    e.printStackTrace();
                }
            }
        }
        System.out.println("=== END MESSAGE HANDLING ===\n");
    }

    @MessageMapping("/chat.group")
    public void sendGroupMessage(@Valid @Payload @NotNull ChatMessage chatMessage) {
        System.out.println("\n=== 👥 GROUP MESSAGE RECEIVED ===");
        System.out.println("Group ID: " + chatMessage.getGroupId());
        System.out.println("From: " + chatMessage.getSender());
        System.out.println("Content: " + chatMessage.getContent());

        if (chatMessage.getGroupId() == null) {
            System.err.println("❌ Error: Group ID is missing");
            return;
        }

        // Sanitize
        if (chatMessage.getContent() != null) {
            chatMessage.setContent(Encode.forHtml(chatMessage.getContent()));
        }
        if (chatMessage.getSender() != null) {
            chatMessage.setSender(Encode.forHtml(chatMessage.getSender()));
        }
        chatMessage.setTimestamp(System.currentTimeMillis());

        // Save to DB
        try {
            messageRepository.save(chatMessage);
            System.out.println("💾 Group message saved");
        } catch (Exception e) {
            System.err.println("❌ Error saving group message: " + e.getMessage());
            e.printStackTrace();
        }

        // Broadcast to group topic
        String destination = "/topic/group." + chatMessage.getGroupId();
        messagingTemplate.convertAndSend(destination, chatMessage);
        System.out.println("📢 Sent to topic: " + destination);
        System.out.println("=== END GROUP MESSAGE HANDLING ===\n");
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

    // REST endpoint to get chat history
    @GetMapping("/messages/{contact}")
    public ResponseEntity<List<ChatMessage>> getChatHistory(
            @PathVariable String contact,
            @RequestParam String currentUser) {
        try {
            List<ChatMessage> messages = messageRepository.findConversationBetween(currentUser, contact);
            return ResponseEntity.ok(messages);
        } catch (Exception e) {
            System.err.println("❌ Error fetching chat history: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
        }
    }
}
