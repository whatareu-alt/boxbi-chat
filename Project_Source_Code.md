
# Boxbi Messenger - Project Source Code Documentation
Generated on 01/27/2026 19:51:05

This document contains the complete source code for the Boxbi Messenger application.

## Table of Contents
1. Backend (Java Spring Boot)
2. Frontend (Public & Local Test)
3. Configuration Files

---


## File: server-spring\src\main\java\com\example\chatengine\serverspring\AdminController.java
`$lang

package com.example.chatengine.serverspring;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@CrossOrigin(origins = {
        "http://localhost:*",
        "http://127.0.0.1:*",
        "https://boxbichat.netlify.app",
        "https://boxbi.online"
})
public class AdminController {

    // Secret admin code - CHANGE THIS TO YOUR OWN SECRET!
    private static final String ADMIN_SECRET = "boxbi@#$%&123";

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private MessageRepository messageRepository;

    @PostMapping("/admin/reset")
    public ResponseEntity<?> resetDatabase(@RequestBody Map<String, String> request) {
        try {
            String providedSecret = request.get("secret");

            // Validate secret code
            if (providedSecret == null || !providedSecret.equals(ADMIN_SECRET)) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "Invalid admin secret code");
                return new ResponseEntity<>(error, HttpStatus.UNAUTHORIZED);
            }

            // Count current data
            long userCount = userRepository.count();
            long messageCount = messageRepository.count();

            // Delete all messages first (due to foreign key constraints)
            messageRepository.deleteAll();

            // Delete all users
            userRepository.deleteAll();

            // Return success response
            Map<String, Object> response = new HashMap<>();
            response.put("message", "Database reset successful");
            response.put("usersDeleted", userCount);
            response.put("messagesDeleted", messageCount);

            System.out.println("ðŸ”´ ADMIN RESET: Deleted " + userCount + " users and " + messageCount + " messages");

            return new ResponseEntity<>(response, HttpStatus.OK);

        } catch (Exception e) {
            e.printStackTrace();
            Map<String, Object> error = new HashMap<>();
            error.put("error", "Reset failed: " + e.getMessage());
            return new ResponseEntity<>(error, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @GetMapping("/admin/stats")
    public ResponseEntity<?> getDatabaseStats(@RequestParam String secret) {
        try {
            // Validate secret code
            if (secret == null || !secret.equals(ADMIN_SECRET)) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "Invalid admin secret code");
                return new ResponseEntity<>(error, HttpStatus.UNAUTHORIZED);
            }

            Map<String, Object> stats = new HashMap<>();
            stats.put("totalUsers", userRepository.count());
            stats.put("totalMessages", messageRepository.count());

            return new ResponseEntity<>(stats, HttpStatus.OK);

        } catch (Exception e) {
            e.printStackTrace();
            Map<String, Object> error = new HashMap<>();
            error.put("error", "Failed to get stats: " + e.getMessage());
            return new ResponseEntity<>(error, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}

`


## File: server-spring\src\main\java\com\example\chatengine\serverspring\ChatController.java
`$lang

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
        "http://localhost:*",
        "http://127.0.0.1:*",
        "https://boxbichat.netlify.app",
        "https://boxbi.online"
})
public class ChatController {

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private MessageRepository messageRepository;

    @Autowired
    private FriendRequestRepository friendRequestRepository;

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
        System.out.println("\n=== ðŸ“¨ PRIVATE MESSAGE RECEIVED ===");
        System.out.println("From: " + chatMessage.getSender());
        System.out.println("To: " + chatMessage.getRecipient());
        System.out.println("Content: " + chatMessage.getContent());

        // Check if users are friends before allowing message
        boolean areFriends = friendRequestRepository.areFriends(
                chatMessage.getSender(),
                chatMessage.getRecipient());

        if (!areFriends) {
            System.out.println("âš ï¸ Message BLOCKED: Users are not friends");
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
            System.out.println("ðŸ’¾ Message saved to database");
        } catch (Exception e) {
            System.err.println("âŒ Error saving message to database: " + e.getMessage());
            e.printStackTrace();
        }

        // Send to specific user
        if (chatMessage.getRecipient() != null) {
            try {
                System.out.println("â†’ Sending to recipient: " + chatMessage.getRecipient());
                messagingTemplate.convertAndSendToUser(
                        Objects.requireNonNull(chatMessage.getRecipient()),
                        "/queue/private",
                        chatMessage);
                System.out.println("âœ… Sent to recipient successfully");
            } catch (Exception e) {
                System.err.println("âŒ Error sending to recipient: " + e.getMessage());
                e.printStackTrace();
            }

            // Also send back to sender so they see it in their chat history
            if (chatMessage.getSender() != null) {
                try {
                    System.out.println("â† Sending back to sender: " + chatMessage.getSender());
                    messagingTemplate.convertAndSendToUser(
                            Objects.requireNonNull(chatMessage.getSender()),
                            "/queue/private",
                            chatMessage);
                    System.out.println("âœ… Sent to sender successfully");
                } catch (Exception e) {
                    System.err.println("âŒ Error sending to sender: " + e.getMessage());
                    e.printStackTrace();
                }
            }
        }
        System.out.println("=== END MESSAGE HANDLING ===\n");
    }

    @MessageMapping("/chat.group")
    public void sendGroupMessage(@Valid @Payload @NotNull ChatMessage chatMessage) {
        System.out.println("\n=== ðŸ‘¥ GROUP MESSAGE RECEIVED ===");
        System.out.println("Group ID: " + chatMessage.getGroupId());
        System.out.println("From: " + chatMessage.getSender());
        System.out.println("Content: " + chatMessage.getContent());

        if (chatMessage.getGroupId() == null) {
            System.err.println("âŒ Error: Group ID is missing");
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
            System.out.println("ðŸ’¾ Group message saved");
        } catch (Exception e) {
            System.err.println("âŒ Error saving group message: " + e.getMessage());
            e.printStackTrace();
        }

        // Broadcast to group topic
        String destination = "/topic/group." + chatMessage.getGroupId();
        messagingTemplate.convertAndSend(destination, chatMessage);
        System.out.println("ðŸ“¢ Sent to topic: " + destination);
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
            System.err.println("âŒ Error fetching chat history: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
        }
    }
}

`


## File: server-spring\src\main\java\com\example\chatengine\serverspring\ChatGroup.java
`$lang

package com.example.chatengine.serverspring;

import jakarta.persistence.*;

@Entity
@Table(name = "chat_groups")
public class ChatGroup {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String createdBy;

    @Column(nullable = false)
    private long createdAt;

    public ChatGroup() {
    }

    public ChatGroup(String name, String createdBy) {
        this.name = name;
        this.createdBy = createdBy;
        this.createdAt = System.currentTimeMillis();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(String createdBy) {
        this.createdBy = createdBy;
    }

    public long getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(long createdAt) {
        this.createdAt = createdAt;
    }
}

`


## File: server-spring\src\main\java\com\example\chatengine\serverspring\ChatMessage.java
`$lang

package com.example.chatengine.serverspring;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Entity
@Table(name = "messages")
public class ChatMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank(message = "Message type is required")
    @Column(nullable = false, length = 20)
    private String type;

    @NotBlank(message = "Message content is required")
    @Size(max = 5000, message = "Message content must not exceed 5000 characters")
    @Column(nullable = false, length = 5000)
    private String content;

    @NotBlank(message = "Sender is required")
    @Column(nullable = false, length = 50)
    private String sender;

    @Column(length = 50)
    private String recipient;

    @Column(name = "group_id")
    private Long groupId;

    @Column(nullable = false)
    private long timestamp;

    public ChatMessage() {
    }

    public ChatMessage(String type, String content, String sender) {
        this.type = type;
        this.content = content;
        this.sender = sender;
        this.recipient = null;
        this.groupId = null;
        this.timestamp = System.currentTimeMillis();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getSender() {
        return sender;
    }

    public void setSender(String sender) {
        this.sender = sender;
    }

    public String getRecipient() {
        return recipient;
    }

    public void setRecipient(String recipient) {
        this.recipient = recipient;
    }

    public Long getGroupId() {
        return groupId;
    }

    public void setGroupId(Long groupId) {
        this.groupId = groupId;
    }

    public long getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(long timestamp) {
        this.timestamp = timestamp;
    }
}

`


## File: server-spring\src\main\java\com\example\chatengine\serverspring\CustomHandshakeHandler.java
`$lang

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

        System.out.println("ðŸ”Œ WebSocket Handshake - Query: " + query);

        if (query != null && query.contains("username=")) {
            String[] params = query.split("&");
            for (String param : params) {
                if (param.startsWith("username=")) {
                    try {
                        username = URLDecoder.decode(param.split("=")[1], "UTF-8");
                        System.out.println("âœ… Extracted username: " + username);
                    } catch (UnsupportedEncodingException e) {
                        username = param.split("=")[1];
                        System.err.println("âš ï¸ URL decode failed, using raw: " + username);
                    }
                    break;
                }
            }
        }

        if (username == null || username.isEmpty()) {
            // Fallback for anonymous or connection without username
            username = "Anonymous";
            System.out.println("âš ï¸ No username found, using: " + username);
        }

        System.out.println("ðŸ‘¤ Setting WebSocket Principal: " + username);
        return new StompPrincipal(username);
    }
}

`


## File: server-spring\src\main\java\com\example\chatengine\serverspring\FriendRequest.java
`$lang

package com.example.chatengine.serverspring;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "friend_requests")
public class FriendRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String senderUsername;

    @Column(nullable = false)
    private String receiverUsername;

    @Column(nullable = false)
    private String status; // PENDING, ACCEPTED, REJECTED

    @Column(nullable = false)
    private LocalDateTime createdAt;

    public FriendRequest() {
        this.createdAt = LocalDateTime.now();
        this.status = "PENDING";
    }

    public FriendRequest(String senderUsername, String receiverUsername) {
        this.senderUsername = senderUsername;
        this.receiverUsername = receiverUsername;
        this.status = "PENDING";
        this.createdAt = LocalDateTime.now();
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getSenderUsername() {
        return senderUsername;
    }

    public void setSenderUsername(String senderUsername) {
        this.senderUsername = senderUsername;
    }

    public String getReceiverUsername() {
        return receiverUsername;
    }

    public void setReceiverUsername(String receiverUsername) {
        this.receiverUsername = receiverUsername;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}

`


## File: server-spring\src\main\java\com\example\chatengine\serverspring\FriendRequestController.java
`$lang

package com.example.chatengine.serverspring;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/friends")
@CrossOrigin(origins = {
        "http://localhost:*",
        "http://127.0.0.1:*",
        "https://boxbichat.netlify.app",
        "https://boxbi.online"
})
public class FriendRequestController {

    @Autowired
    private FriendRequestRepository friendRequestRepository;

    @Autowired
    private UserRepository userRepository;

    // Send friend request
    @PostMapping("/request")
    public ResponseEntity<?> sendFriendRequest(@RequestBody Map<String, String> request) {
        try {
            String senderUsername = request.get("sender");
            String receiverUsername = request.get("receiver");

            // Validate users exist
            if (!userRepository.findAll().stream().anyMatch(u -> u.getUsername().equals(receiverUsername))) {
                return ResponseEntity.badRequest().body(Map.of("error", "User not found"));
            }

            // Check if request already exists
            Optional<FriendRequest> existing = friendRequestRepository
                    .findBySenderUsernameAndReceiverUsername(senderUsername, receiverUsername);

            if (existing.isPresent()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Request already sent"));
            }

            // Check reverse (already friends or pending)
            Optional<FriendRequest> reverse = friendRequestRepository
                    .findBySenderUsernameAndReceiverUsername(receiverUsername, senderUsername);

            if (reverse.isPresent()) {
                if (reverse.get().getStatus().equals("ACCEPTED")) {
                    return ResponseEntity.badRequest().body(Map.of("error", "Already friends"));
                } else if (reverse.get().getStatus().equals("PENDING")) {
                    return ResponseEntity.badRequest().body(Map.of("error", "This user already sent you a request"));
                }
            }

            // Create new friend request
            FriendRequest friendRequest = new FriendRequest(senderUsername, receiverUsername);
            friendRequestRepository.save(friendRequest);

            return ResponseEntity.ok(Map.of("message", "Friend request sent", "id", friendRequest.getId()));

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to send request"));
        }
    }

    // Get pending received requests
    @GetMapping("/requests/pending")
    public ResponseEntity<?> getPendingRequests(@RequestParam String username) {
        try {
            List<FriendRequest> requests = friendRequestRepository
                    .findByReceiverUsernameAndStatus(username, "PENDING");

            List<Map<String, Object>> result = new ArrayList<>();
            for (FriendRequest req : requests) {
                Map<String, Object> data = new HashMap<>();
                data.put("id", req.getId());
                data.put("sender", req.getSenderUsername());
                data.put("createdAt", req.getCreatedAt().toString());
                result.add(data);
            }

            return ResponseEntity.ok(result);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to get requests"));
        }
    }

    // Accept friend request
    @PostMapping("/accept/{id}")
    public ResponseEntity<?> acceptRequest(@PathVariable long id) {
        try {
            Optional<FriendRequest> requestOpt = friendRequestRepository.findById(id);

            if (requestOpt.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Request not found"));
            }

            FriendRequest request = requestOpt.get();
            request.setStatus("ACCEPTED");
            friendRequestRepository.save(request);

            return ResponseEntity.ok(Map.of("message", "Friend request accepted"));

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to accept request"));
        }
    }

    // Reject friend request
    @PostMapping("/reject/{id}")
    public ResponseEntity<?> rejectRequest(@PathVariable long id) {
        try {
            Optional<FriendRequest> requestOpt = friendRequestRepository.findById(id);

            if (requestOpt.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Request not found"));
            }

            FriendRequest request = requestOpt.get();
            request.setStatus("REJECTED");
            friendRequestRepository.save(request);

            return ResponseEntity.ok(Map.of("message", "Friend request rejected"));

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to reject request"));
        }
    }

    // Get friends list
    @GetMapping("/list")
    public ResponseEntity<?> getFriendsList(@RequestParam String username) {
        try {
            List<FriendRequest> friendships = friendRequestRepository.findAcceptedFriends(username);

            List<String> friends = new ArrayList<>();
            for (FriendRequest friendship : friendships) {
                if (friendship.getSenderUsername().equals(username)) {
                    friends.add(friendship.getReceiverUsername());
                } else {
                    friends.add(friendship.getSenderUsername());
                }
            }

            return ResponseEntity.ok(friends);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to get friends"));
        }
    }

    // Check if two users are friends
    @GetMapping("/check/{username}")
    public ResponseEntity<?> checkFriendship(@PathVariable String username, @RequestParam String currentUser) {
        try {
            boolean areFriends = friendRequestRepository.areFriends(currentUser, username);

            // Also check for pending request
            Optional<FriendRequest> pending = friendRequestRepository
                    .findBySenderUsernameAndReceiverUsername(currentUser, username);

            String status = "none";
            Long requestId = null;

            if (areFriends) {
                status = "friends";
            } else if (pending.isPresent() && pending.get().getStatus().equals("PENDING")) {
                status = "pending_sent";
                requestId = pending.get().getId();
            } else {
                // Check reverse
                Optional<FriendRequest> reverse = friendRequestRepository
                        .findBySenderUsernameAndReceiverUsername(username, currentUser);
                if (reverse.isPresent() && reverse.get().getStatus().equals("PENDING")) {
                    status = "pending_received";
                    requestId = reverse.get().getId();
                }
            }

            Map<String, Object> result = new HashMap<>();
            result.put("status", status);
            result.put("areFriends", areFriends);
            if (requestId != null) {
                result.put("requestId", requestId);
            }

            return ResponseEntity.ok(result);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to check friendship"));
        }
    }
}

`


## File: server-spring\src\main\java\com\example\chatengine\serverspring\FriendRequestRepository.java
`$lang

package com.example.chatengine.serverspring;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface FriendRequestRepository extends JpaRepository<FriendRequest, Long> {

        // Find request between two users
        Optional<FriendRequest> findBySenderUsernameAndReceiverUsername(String sender, String receiver);

        // Get all pending requests for a user (received)
        List<FriendRequest> findByReceiverUsernameAndStatus(String receiver, String status);

        // Get all requests sent by a user
        List<FriendRequest> findBySenderUsernameAndStatus(String sender, String status);

        // Check if two users are friends (accepted request exists)
        @Query("SELECT f FROM FriendRequest f " +
                        "WHERE ((f.senderUsername = :user1 AND f.receiverUsername = :user2) " +
                        "OR (f.senderUsername = :user2 AND f.receiverUsername = :user1)) " +
                        "AND f.status = 'ACCEPTED'")
        List<FriendRequest> findFriendship(@Param("user1") String user1, @Param("user2") String user2);

        default boolean areFriends(String user1, String user2) {
                return !findFriendship(user1, user2).isEmpty();
        }

        // Get all accepted friends for a user
        @Query("SELECT f FROM FriendRequest f " +
                        "WHERE (f.senderUsername = :username OR f.receiverUsername = :username) " +
                        "AND f.status = 'ACCEPTED'")
        List<FriendRequest> findAcceptedFriends(@Param("username") String username);
}

`


## File: server-spring\src\main\java\com\example\chatengine\serverspring\GroupController.java
`$lang

package com.example.chatengine.serverspring;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/groups")
@CrossOrigin(origins = {
        "http://localhost:*",
        "http://127.0.0.1:*",
        "https://boxbichat.netlify.app",
        "https://boxbi.online"
})
public class GroupController {

    @Autowired
    private GroupRepository groupRepository;

    @Autowired
    private GroupMemberRepository groupMemberRepository;

    @Autowired
    private MessageRepository messageRepository;

    @PostMapping("/create")
    public ResponseEntity<?> createGroup(@RequestBody Map<String, Object> payload) {
        try {
            System.out.println("Received create group request: " + payload);
            String name = (String) payload.get("name");
            String createdBy = (String) payload.get("createdBy");
            @SuppressWarnings("unchecked")
            List<String> members = (List<String>) payload.get("members");

            if (name == null || name.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Group name is required"));
            }
            if (createdBy == null || createdBy.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Creator username is required"));
            }

            ChatGroup group = new ChatGroup(name, createdBy);
            group = groupRepository.save(group);
            System.out.println("Group created with ID: " + group.getId());

            // Add creator as member
            groupMemberRepository.save(new GroupMember(group, createdBy));

            // Add other members
            if (members != null) {
                for (String member : members) {
                    if (member != null && !member.isEmpty() && !member.equals(createdBy)) {
                        groupMemberRepository.save(new GroupMember(group, member));
                    }
                }
            }
            return ResponseEntity.ok(group);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of("error", "Failed to create group: " + e.getMessage()));
        }
    }

    @GetMapping("/user/{username}")
    public ResponseEntity<List<ChatGroup>> getUserGroups(@PathVariable String username) {
        List<GroupMember> memberships = groupMemberRepository.findByUsername(username);
        List<ChatGroup> groups = memberships.stream()
                .map(GroupMember::getGroup)
                .collect(Collectors.toList());
        return ResponseEntity.ok(groups);
    }

    @GetMapping("/{groupId}/messages")
    public ResponseEntity<List<ChatMessage>> getGroupMessages(@PathVariable Long groupId) {
        List<ChatMessage> messages = messageRepository.findByGroupIdOrderByTimestamp(groupId);
        return ResponseEntity.ok(messages);
    }
}

`


## File: server-spring\src\main\java\com\example\chatengine\serverspring\GroupMember.java
`$lang

package com.example.chatengine.serverspring;

import jakarta.persistence.*;
import com.fasterxml.jackson.annotation.JsonIgnore;

@Entity
@Table(name = "group_members")
public class GroupMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "group_id", nullable = false)
    @JsonIgnore
    private ChatGroup group;

    @Column(nullable = false)
    private String username;

    public GroupMember() {
    }

    public GroupMember(ChatGroup group, String username) {
        this.group = group;
        this.username = username;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public ChatGroup getGroup() {
        return group;
    }

    public void setGroup(ChatGroup group) {
        this.group = group;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }
}

`


## File: server-spring\src\main\java\com\example\chatengine\serverspring\GroupMemberRepository.java
`$lang

package com.example.chatengine.serverspring;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface GroupMemberRepository extends JpaRepository<GroupMember, Long> {
    List<GroupMember> findByUsername(String username);

    List<GroupMember> findByGroup(ChatGroup group);

    boolean existsByGroupAndUsername(ChatGroup group, String username);
}

`


## File: server-spring\src\main\java\com\example\chatengine\serverspring\GroupRepository.java
`$lang

package com.example.chatengine.serverspring;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface GroupRepository extends JpaRepository<ChatGroup, Long> {
    List<ChatGroup> findByCreatedBy(String createdBy);
}

`


## File: server-spring\src\main\java\com\example\chatengine\serverspring\MessageRepository.java
`$lang

package com.example.chatengine.serverspring;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface MessageRepository extends JpaRepository<ChatMessage, Long> {

    // Find all messages between two users (bidirectional conversation)
    @Query("SELECT m FROM ChatMessage m WHERE " +
            "(m.sender = :user1 AND m.recipient = :user2) OR " +
            "(m.sender = :user2 AND m.recipient = :user1) " +
            "ORDER BY m.timestamp ASC")
    List<ChatMessage> findConversationBetween(@Param("user1") String user1, @Param("user2") String user2);

    List<ChatMessage> findByGroupIdOrderByTimestamp(Long groupId);
}

`


## File: server-spring\src\main\java\com\example\chatengine\serverspring\ServerSpringApplication.java
`$lang

package com.example.chatengine.serverspring;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class ServerSpringApplication {

	public static void main(String[] args) {
		SpringApplication.run(ServerSpringApplication.class, args);
	}

}

`


## File: server-spring\src\main\java\com\example\chatengine\serverspring\StompPrincipal.java
`$lang

package com.example.chatengine.serverspring;

import java.security.Principal;

public class StompPrincipal implements Principal {
    private String name;

    public StompPrincipal(String name) {
        this.name = name;
    }

    @Override
    public String getName() {
        return name;
    }
}

`


## File: server-spring\src\main\java\com\example\chatengine\serverspring\User.java
`$lang

package com.example.chatengine.serverspring;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @jakarta.persistence.Column(unique = true, nullable = false, length = 50)
    private String username;

    @jakarta.persistence.Column(nullable = false)
    private String secret; // password (hashed)

    @jakarta.persistence.Column(unique = true, nullable = false)
    private String email;

    private String firstName;
    private String lastName;

    @jakarta.persistence.Column(name = "last_active")
    private java.time.LocalDateTime lastActive;

    public User() {
    }

    public User(String username, String secret, String email, String firstName, String lastName) {
        this.username = username;
        this.secret = secret;
        this.email = email;
        this.firstName = firstName;
        this.lastName = lastName;
        this.lastActive = java.time.LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getSecret() {
        return secret;
    }

    public void setSecret(String secret) {
        this.secret = secret;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getFirstName() {
        return firstName;
    }

    public void setFirstName(String firstName) {
        this.firstName = firstName;
    }

    public String getLastName() {
        return lastName;
    }

    public void setLastName(String lastName) {
        this.lastName = lastName;
    }

    public java.time.LocalDateTime getLastActive() {
        return lastActive;
    }

    public void setLastActive(java.time.LocalDateTime lastActive) {
        this.lastActive = lastActive;
    }
}

`


## File: server-spring\src\main\java\com\example\chatengine\serverspring\UserCleanupScheduler.java
`$lang

package com.example.chatengine.serverspring;

import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
public class UserCleanupScheduler {

    @Autowired
    private UserRepository userRepository;

    // Run every hour
    @Scheduled(cron = "0 0 * * * ?")
    @Transactional
    public void cleanupInactiveUsers() {
        // Delete users inactive for more than 24 hours
        LocalDateTime cutoff = LocalDateTime.now().minusHours(24);

        // You can adjust the days here. For testing, you might want to use minutes.
        // LocalDateTime cutoff = LocalDateTime.now().minusMinutes(30);

        System.out.println("Running user cleanup for users inactive since " + cutoff);
        userRepository.deleteByLastActiveBefore(cutoff);
    }
}

`


## File: server-spring\src\main\java\com\example\chatengine\serverspring\UserController.java
`$lang

package com.example.chatengine.serverspring;

import com.example.chatengine.serverspring.dto.AuthResponse;
import com.example.chatengine.serverspring.dto.LoginRequest;
import com.example.chatengine.serverspring.dto.SignupRequest;
import com.example.chatengine.serverspring.security.JwtUtil;
import jakarta.validation.Valid;
import org.owasp.encoder.Encode;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@CrossOrigin(origins = {
        "http://localhost:*",
        "http://127.0.0.1:*",
        "https://boxbichat.netlify.app",
        "https://boxbi.online"
})
public class UserController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtUtil jwtUtil;

    @CrossOrigin
    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request) {
        try {
            // Sanitize input
            String username = Encode.forHtml(request.getUsername().trim());
            String password = request.getSecret();

            if (username.isEmpty()) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "Username is required");
                return new ResponseEntity<>(error, HttpStatus.BAD_REQUEST);
            }

            // Check if user exists in DB
            // Using defensive approach to handle potential duplicates
            java.util.List<User> users = userRepository.findAll().stream()
                    .filter(u -> u.getUsername().equals(username))
                    .toList();

            if (users.isEmpty()) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "Invalid credentials");
                return new ResponseEntity<>(error, HttpStatus.UNAUTHORIZED);
            }

            // If duplicates exist, use the first one (this shouldn't happen with proper
            // constraints)
            User user = users.get(0);

            // Verify password with BCrypt
            if (!passwordEncoder.matches(password, user.getSecret())) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "Invalid credentials");
                return new ResponseEntity<>(error, HttpStatus.UNAUTHORIZED);
            }

            // Update last active time
            user.setLastActive(java.time.LocalDateTime.now());
            userRepository.save(user);

            // Generate JWT token
            String token = jwtUtil.generateToken(user.getUsername());

            // Return user data with JWT token
            AuthResponse response = new AuthResponse(
                    token,
                    user.getUsername(),
                    user.getEmail(),
                    user.getFirstName(),
                    user.getLastName(),
                    user.getId());

            return new ResponseEntity<>(response, HttpStatus.OK);
        } catch (RuntimeException e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", e.getMessage());
            return new ResponseEntity<>(error, HttpStatus.UNAUTHORIZED);
        } catch (Exception e) {
            e.printStackTrace();
            Map<String, Object> error = new HashMap<>();
            error.put("error", "Internal server error");
            return new ResponseEntity<>(error, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @CrossOrigin
    @PostMapping("/signup")
    public ResponseEntity<?> signup(@Valid @RequestBody SignupRequest request) {
        try {
            // Sanitize input
            String username = Encode.forHtml(request.getUsername().trim());
            String email = Encode.forHtml(request.getEmail().trim());
            String firstName = request.getFirstName() != null ? Encode.forHtml(request.getFirstName().trim()) : "";
            String lastName = request.getLastName() != null ? Encode.forHtml(request.getLastName().trim()) : "";
            String password = request.getSecret();

            if (username.isEmpty()) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "Username is required");
                return new ResponseEntity<>(error, HttpStatus.BAD_REQUEST);
            }

            // Check if user already exists (defensive check for duplicates)
            java.util.List<User> existingUsers = userRepository.findAll().stream()
                    .filter(u -> u.getUsername().equals(username))
                    .toList();

            if (!existingUsers.isEmpty()) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "Username already exists");
                return new ResponseEntity<>(error, HttpStatus.CONFLICT);
            }

            // Hash password with BCrypt
            String hashedPassword = passwordEncoder.encode(password);

            // Create new user in DB
            User newUser = new User(username, hashedPassword, email, firstName, lastName);
            userRepository.save(newUser);

            // Generate JWT token
            String token = jwtUtil.generateToken(newUser.getUsername());

            // Return user data with JWT token
            AuthResponse response = new AuthResponse(
                    token,
                    newUser.getUsername(),
                    newUser.getEmail(),
                    newUser.getFirstName(),
                    newUser.getLastName(),
                    newUser.getId());

            return new ResponseEntity<>(response, HttpStatus.CREATED);
        } catch (Exception e) {
            e.printStackTrace();
            Map<String, Object> error = new HashMap<>();
            error.put("error", "Internal server error");
            return new ResponseEntity<>(error, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @CrossOrigin
    @GetMapping("/users/search")
    public List<Map<String, Object>> searchUsers(@RequestParam(defaultValue = "") String username) {
        List<Map<String, Object>> results = new ArrayList<>();

        // Sanitize search query
        String sanitizedQuery = Encode.forHtml(username.trim());

        List<User> users;
        if (sanitizedQuery.isEmpty()) {
            // Return all users if no query provided
            users = userRepository.findAll();
        } else {
            users = userRepository
                    .findByUsernameContainingIgnoreCaseOrFirstNameContainingIgnoreCaseOrLastNameContainingIgnoreCase(
                            sanitizedQuery, sanitizedQuery, sanitizedQuery);
        }

        for (User user : users) {
            Map<String, Object> publicProfile = new HashMap<>();
            publicProfile.put("username", user.getUsername());
            publicProfile.put("email", user.getEmail());
            publicProfile.put("firstName", user.getFirstName());
            publicProfile.put("lastName", user.getLastName());
            results.add(publicProfile);
        }
        return results;
    }
}

`


## File: server-spring\src\main\java\com\example\chatengine\serverspring\UserRepository.java
`$lang

package com.example.chatengine.serverspring;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByUsername(String username);

    List<User> findByUsernameContainingIgnoreCaseOrFirstNameContainingIgnoreCaseOrLastNameContainingIgnoreCase(
            String username, String firstName, String lastName);

    void deleteByLastActiveBefore(java.time.LocalDateTime dateTime);
}

`


## File: server-spring\src\main\java\com\example\chatengine\serverspring\WebSocketConfig.java
`$lang

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
        // Allow origins for Railway deployment and local development
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*")
                .setHandshakeHandler(new CustomHandshakeHandler())
                .withSockJS();
    }
}

`


## File: server-spring\src\main\java\com\example\chatengine\serverspring\dto\AuthResponse.java
`$lang

package com.example.chatengine.serverspring.dto;

public class AuthResponse {
    private String token;
    private String username;
    private String email;
    private String firstName;
    private String lastName;
    private Long id;

    public AuthResponse() {
    }

    public AuthResponse(String token, String username, String email, String firstName, String lastName, Long id) {
        this.token = token;
        this.username = username;
        this.email = email;
        this.firstName = firstName;
        this.lastName = lastName;
        this.id = id;
    }

    public String getToken() {
        return token;
    }

    public void setToken(String token) {
        this.token = token;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getFirstName() {
        return firstName;
    }

    public void setFirstName(String firstName) {
        this.firstName = firstName;
    }

    public String getLastName() {
        return lastName;
    }

    public void setLastName(String lastName) {
        this.lastName = lastName;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }
}

`


## File: server-spring\src\main\java\com\example\chatengine\serverspring\dto\LoginRequest.java
`$lang

package com.example.chatengine.serverspring.dto;

import jakarta.validation.constraints.NotBlank;

public class LoginRequest {

    @NotBlank(message = "Username is required")
    private String username;

    @NotBlank(message = "Password is required")
    private String secret;

    public LoginRequest() {
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getSecret() {
        return secret;
    }

    public void setSecret(String secret) {
        this.secret = secret;
    }
}

`


## File: server-spring\src\main\java\com\example\chatengine\serverspring\dto\SignupRequest.java
`$lang

package com.example.chatengine.serverspring.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class SignupRequest {

    @NotBlank(message = "Username is required")
    @Size(min = 3, max = 50, message = "Username must be between 3 and 50 characters")
    private String username;

    @NotBlank(message = "Password is required")
    @Size(min = 6, max = 100, message = "Password must be between 6 and 100 characters")
    private String secret;

    @Email(message = "Email should be valid")
    @NotBlank(message = "Email is required")
    private String email;

    @Size(max = 50, message = "First name must not exceed 50 characters")
    private String firstName;

    @Size(max = 50, message = "Last name must not exceed 50 characters")
    private String lastName;

    public SignupRequest() {
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getSecret() {
        return secret;
    }

    public void setSecret(String secret) {
        this.secret = secret;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getFirstName() {
        return firstName;
    }

    public void setFirstName(String firstName) {
        this.firstName = firstName;
    }

    public String getLastName() {
        return lastName;
    }

    public void setLastName(String lastName) {
        this.lastName = lastName;
    }
}

`


## File: server-spring\src\main\java\com\example\chatengine\serverspring\security\CustomUserDetailsService.java
`$lang

package com.example.chatengine.serverspring.security;

import com.example.chatengine.serverspring.User;
import com.example.chatengine.serverspring.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.ArrayList;

@Service
public class CustomUserDetailsService implements UserDetailsService {

    @Autowired
    private UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + username));

        return new org.springframework.security.core.userdetails.User(
                user.getUsername(),
                user.getSecret(),
                new ArrayList<>());
    }
}

`


## File: server-spring\src\main\java\com\example\chatengine\serverspring\security\JwtAuthenticationFilter.java
`$lang

package com.example.chatengine.serverspring.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private UserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain chain)
            throws ServletException, IOException {

        final String authorizationHeader = request.getHeader("Authorization");

        String username = null;
        String jwt = null;

        if (authorizationHeader != null && authorizationHeader.startsWith("Bearer ")) {
            jwt = authorizationHeader.substring(7);
            try {
                username = jwtUtil.extractUsername(jwt);
            } catch (Exception e) {
                logger.warn("JWT token extraction failed: " + e.getMessage());
            }
        }

        if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            UserDetails userDetails = this.userDetailsService.loadUserByUsername(username);

            if (jwtUtil.validateToken(jwt, userDetails.getUsername())) {
                UsernamePasswordAuthenticationToken authenticationToken = new UsernamePasswordAuthenticationToken(
                        userDetails, null, userDetails.getAuthorities());
                authenticationToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authenticationToken);
            }
        }
        chain.doFilter(request, response);
    }
}

`


## File: server-spring\src\main\java\com\example\chatengine\serverspring\security\JwtUtil.java
`$lang

package com.example.chatengine.serverspring.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Function;

@Component
public class JwtUtil {

    @Value("${jwt.secret:boxbi-messenger-super-secret-key-change-this-in-production-2024}")
    private String secret;

    @Value("${jwt.expiration:86400000}") // 24 hours in milliseconds
    private Long expiration;

    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(secret.getBytes());
    }

    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    public Date extractExpiration(String token) {
        return extractClaim(token, Claims::getExpiration);
    }

    public <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }

    private Claims extractAllClaims(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    private Boolean isTokenExpired(String token) {
        return extractExpiration(token).before(new Date());
    }

    public String generateToken(String username) {
        Map<String, Object> claims = new HashMap<>();
        return createToken(claims, username);
    }

    private String createToken(Map<String, Object> claims, String subject) {
        return Jwts.builder()
                .claims(claims)
                .subject(subject)
                .issuedAt(new Date(System.currentTimeMillis()))
                .expiration(new Date(System.currentTimeMillis() + expiration))
                .signWith(getSigningKey())
                .compact();
    }

    public Boolean validateToken(String token, String username) {
        final String extractedUsername = extractUsername(token);
        return (extractedUsername.equals(username) && !isTokenExpired(token));
    }
}

`


## File: server-spring\src\main\java\com\example\chatengine\serverspring\security\RateLimitingFilter.java
`$lang

package com.example.chatengine.serverspring.security;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class RateLimitingFilter extends OncePerRequestFilter {

    private final Map<String, Bucket> cache = new ConcurrentHashMap<>();

    private Bucket createNewBucket() {
        // Allow 100 requests per minute per IP
        Bandwidth limit = Bandwidth.builder()
                .capacity(100)
                .refillGreedy(100, Duration.ofMinutes(1))
                .build();
        return Bucket.builder()
                .addLimit(limit)
                .build();
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain chain)
            throws ServletException, IOException {

        String clientIp = getClientIP(request);
        Bucket bucket = cache.computeIfAbsent(clientIp, k -> createNewBucket());

        if (bucket.tryConsume(1)) {
            chain.doFilter(request, response);
        } else {
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setContentType("application/json");
            response.getWriter().write("{\"error\": \"Too many requests. Please try again later.\"}");
        }
    }

    private String getClientIP(HttpServletRequest request) {
        String xfHeader = request.getHeader("X-Forwarded-For");
        if (xfHeader == null) {
            return request.getRemoteAddr();
        }
        return xfHeader.split(",")[0];
    }
}

`


## File: server-spring\src\main\java\com\example\chatengine\serverspring\security\SecurityConfig.java
`$lang

package com.example.chatengine.serverspring.security;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

        @Autowired
        private JwtAuthenticationFilter jwtAuthenticationFilter;

        @Bean
        public PasswordEncoder passwordEncoder() {
                return new BCryptPasswordEncoder();
        }

        @Bean
        public AuthenticationManager authenticationManager(AuthenticationConfiguration authenticationConfiguration)
                        throws Exception {
                return authenticationConfiguration.getAuthenticationManager();
        }

        @Bean
        public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
                http
                                .csrf(csrf -> csrf.disable())
                                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                                .authorizeHttpRequests(auth -> auth
                                                .requestMatchers("/login", "/signup", "/ws/**", "/h2-console/**",
                                                                "/users/**", "/friends/**", "/groups/**", "/admin/**",
                                                                "/messages/**",
                                                                "/", "/index.html", "/local_test.html", "/static/**",
                                                                "/*.html")
                                                .permitAll()
                                                .anyRequest().authenticated())
                                .sessionManagement(session -> session
                                                .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                                .headers(headers -> headers
                                                .frameOptions(frame -> frame.sameOrigin()) // For H2 console
                                );

                http.addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

                return http.build();
        }

        @Bean
        public CorsConfigurationSource corsConfigurationSource() {
                CorsConfiguration configuration = new CorsConfiguration();
                configuration.setAllowedOriginPatterns(Arrays.asList(
                                "*",
                                "http://localhost:*",
                                "http://127.0.0.1:*",
                                "https://boxbichat.netlify.app",
                                "https://boxbi.online",
                                "http://boxbi.online"));
                configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS"));
                configuration.setAllowedHeaders(Arrays.asList("*"));
                configuration.setAllowCredentials(true);
                configuration.setMaxAge(3600L);

                UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
                source.registerCorsConfiguration("/**", configuration);
                return source;
        }
}

`


## File: public\index.html
`$lang

<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Boxbi Messenger</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0" />
    <link rel="stylesheet" href="style.css">
</head>

<body>

    <!-- Auth Page -->
    <div id="auth-page" class="auth-page">
        <h1>ðŸ’¬ Boxbi Messenger</h1>
        <p>Welcome back! Please login to continue.</p>

        <!-- Login Form -->
        <form id="login-form">
            <div class="form-group">
                <label for="login-username">Username</label>
                <input type="text" id="login-username" required autocomplete="username">
            </div>
            <div class="form-group">
                <label for="login-password">Password</label>
                <input type="password" id="login-password" required autocomplete="current-password">
            </div>

            <div style="display: flex; align-items: center; margin-bottom: 20px; gap: 8px;">
                <input type="checkbox" id="remember-me" checked style="width: auto;">
                <label for="remember-me" style="margin: 0; font-size: 13px; color: #666; cursor: pointer;">Remember
                    Me</label>
            </div>

            <button type="submit" class="btn">Sign In</button>
            <div class="error hidden" id="login-error"></div>

            <div style="margin-top: 15px; text-align: center;">
                <a href="#" onclick="showAdminReset(); return false;"
                    style="font-size: 12px; color: #999; text-decoration: none;">Reset App Data (Admin)</a>
            </div>
        </form>

        <div class="toggle-auth">
            Don't have an account? <a href="#" id="show-signup">Sign up</a>
        </div>

        <!-- Signup Form -->
        <form id="signup-form" class="hidden">
            <div class="form-group">
                <label for="signup-username">Username</label>
                <input type="text" id="signup-username" required>
            </div>
            <div class="form-group">
                <label for="signup-email">Email</label>
                <input type="email" id="signup-email" required>
            </div>
            <div class="form-group">
                <label for="signup-firstname">First Name</label>
                <input type="text" id="signup-firstname" required>
            </div>
            <div class="form-group">
                <label for="signup-lastname">Last Name</label>
                <input type="text" id="signup-lastname" required>
            </div>
            <div class="form-group">
                <label for="signup-password">Password</label>
                <input type="password" id="signup-password" required>
            </div>
            <button type="submit" class="btn">Sign Up</button>
            <div class="error hidden" id="signup-error"></div>
        </form>

        <div class="toggle-auth hidden" id="show-login-link">
            Have an account? <a href="#" id="show-login">Sign in</a>
        </div>

        <!-- Admin Reset Button -->
        <div style="text-align: center; margin-top: 20px;">
            <button onclick="showAdminReset()"
                style="padding: 8px 16px; background: #dc3545; color: white; border: none; border-radius: 6px; font-size: 12px; cursor: pointer; opacity: 0.7;">Admin
                Reset</button>
        </div>
    </div>

    <!-- Admin Reset Modal -->
    <div id="admin-modal"
        style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999; justify-content: center; align-items: center;">
        <div style="background: white; padding: 30px; border-radius: 12px; max-width: 400px; width: 90%;">
            <h2 style="margin: 0 0 10px 0; font-size: 20px;">ðŸ” Admin Reset</h2>
            <p style="color: #666; font-size: 14px; margin-bottom: 20px;">Enter admin secret code to reset all data</p>
            <input type="password" id="admin-secret" placeholder="Enter secret code"
                style="width: 100%; padding: 10px; border: 1.5px solid #e0e0e0; border-radius: 8px; font-size: 14px; margin-bottom: 16px;">
            <div id="admin-error" style="color: #d32f2f; font-size: 12px; margin-bottom: 12px; display: none;"></div>
            <div style="display: flex; gap: 12px;">
                <button onclick="hideAdminReset()"
                    style="flex: 1; padding: 10px; background: #f5f5f5; color: #333; border: none; border-radius: 8px; font-size: 14px; cursor: pointer;">Cancel</button>
                <button onclick="executeAdminReset()"
                    style="flex: 1; padding: 10px; background: #dc3545; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;">Reset
                    All Data</button>
            </div>
        </div>
    </div>

    <!-- Create Group Modal -->
    <div id="create-group-modal" class="modal">
        <div class="modal-content">
            <h2 style="margin-bottom: 15px;">Create New Group</h2>
            <div class="form-group">
                <label>Group Name</label>
                <input type="text" id="group-name-input" placeholder="Enter group name...">
            </div>
            <div class="form-group">
                <label>Select Members</label>
                <div class="multi-select-list" id="group-user-select">
                    <!-- Populated by JS -->
                </div>
            </div>
            <div style="display: flex; gap: 10px; margin-top: 15px;">
                <button onclick="document.getElementById('create-group-modal').style.display='none'" class="btn"
                    style="background: #ccc; color: #333;">Cancel</button>
                <button onclick="submitCreateGroup()" class="btn">Create Group</button>
            </div>
        </div>
    </div>

    <!-- Chat App -->
    <div id="chat-app" class="chat-app">
        <!-- Users Sidebar -->
        <div class="users-sidebar">
            <div class="sidebar-header">
                <h2 id="current-username">Loading...</h2>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <div style="font-size: 12px; color: #4ade80;">Online</div>
                    <button onclick="toggleFriendRequests()"
                        style="position: relative; background: none; border: none; cursor: pointer; display: flex; align-items: center;"
                        title="Friend Requests">
                        <span class="material-symbols-outlined" style="font-size: 24px;">group_add</span>
                        <span id="request-badge"
                            style="position: absolute; top: -5px; right: -5px; background: #dc3545; color: white; border-radius: 50%; width: 15px; height: 15px; font-size: 10px; display: none; justify-content: center; align-items: center;">0</span>
                    </button>
                    <button id="refresh-btn" onclick="refreshData()"
                        style="background: none; border: none; cursor: pointer; transition: transform 0.3s; display: flex; align-items: center;"
                        title="Refresh Data">
                        <span class="material-symbols-outlined" style="font-size: 24px;">refresh</span>
                    </button>
                    <button onclick="logout()"
                        style="background: none; border: none; cursor: pointer; display: flex; align-items: center;"
                        title="Logout">
                        <span class="material-symbols-outlined" style="font-size: 24px;">logout</span>
                    </button>
                </div>
            </div>

            <!-- Sidebar Tabs -->
            <div class="sidebar-tabs">
                <button class="tab-btn active" onclick="switchTab('chats')">Chats</button>
                <button class="tab-btn" onclick="switchTab('groups')">Groups</button>
            </div>

            <!-- CHATS TAB -->
            <div id="tab-chats" class="tab-content active">
                <div id="requests-panel"
                    style="display: none; background: #f8f9fa; border-bottom: 1px solid #eee; padding: 10px;">
                    <h3 style="margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase; color: #666;">Friend
                        Requests
                    </h3>
                    <div id="pending-requests-list" style="max-height: 150px; overflow-y: auto;">
                        <div style="color: #999; font-size: 12px; text-align: center;">No pending requests</div>
                    </div>
                </div>

                <div class="search-box">
                    <input type="text" id="user-search" placeholder="Search users..." onkeyup="filterUsers(this.value)">
                </div>
                <div class="users-list" id="users-list">
                    <div class="empty-state">Loading users...</div>
                </div>
            </div>

            <!-- GROUPS TAB -->
            <div id="tab-groups" class="tab-content">
                <div style="padding: 10px;">
                    <button class="btn" style="padding: 8px;" onclick="openCreateGroupModal()">
                        + Create New Group
                    </button>
                </div>
                <div class="users-list" id="groups-list">
                    <div class="empty-state">Loading groups...</div>
                </div>
            </div>
        </div>

        <!-- Chat Area -->
        <div class="chat-area">
            <div class="chat-header">
                <div class="chat-header-info">
                    <button class="back-button" onclick="exitChatView()"
                        style="display: none; background: none; border: none; cursor: pointer; margin-right: 10px; color: #333; align-items: center;">
                        <span class="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div class="user-avatar" id="chat-avatar">?</div>
                    <div>
                        <h3 id="chat-name">Select a user to chat</h3>
                        <div class="status" id="chat-status"></div>
                    </div>
                </div>
                <button class="logout-btn" id="logout-btn" onclick="logout()">Logout</button>
            </div>

            <div class="messages-container" id="messages">
                <div class="welcome-screen">
                    <h2>ðŸ‘‹ Welcome!</h2>
                    <p>Select a user from the left to start chatting</p>
                </div>
            </div>

            <div class="chat-input">
                <form class="chat-input-form" id="message-form">
                    <input type="text" id="message-input" placeholder="Type a message..." autocomplete="off" disabled>
                    <button type="submit" class="send-btn" id="send-btn" disabled>Send</button>
                </form>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/sockjs-client@1/dist/sockjs.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/stompjs@2.3.3/lib/stomp.min.js"></script>
    <script>
        // API URL CONFIGURATION
        let API_URL;
        if (window.location.hostname.includes('netlify.app') || window.location.hostname.includes('boxbi.online')) {
            // If running on Netlify or custom domain, connect to Render Backend
            API_URL = 'https://boxbi-backend.onrender.com';
        } else if (window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            // Local development: Connect to local backend
            API_URL = 'http://localhost:8081';
        } else {
            // If running on Render (Monolith), use current origin
            API_URL = window.location.origin;
        }

        let stompClient = null;
        let currentUser = null;
        let selectedRecipient = null;
        let activeGroupId = null; // Track active group
        let allUsers = [];
        let myGroups = [];
        let currentTab = 'chats';

        function switchTab(tab) {
            currentTab = tab;
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

            if (tab === 'chats') {
                document.querySelector('.tab-btn:nth-child(1)').classList.add('active');
                document.getElementById('tab-chats').classList.add('active');
            } else {
                document.querySelector('.tab-btn:nth-child(2)').classList.add('active');
                document.getElementById('tab-groups').classList.add('active');
                fetchMyGroups();
            }
        }

        // Auto-login from saved session
        window.addEventListener('DOMContentLoaded', () => {
            const savedUser = localStorage.getItem('currentUser');
            if (savedUser) {
                try {
                    currentUser = JSON.parse(savedUser);
                    console.log('ðŸ”„ Auto-logging in as:', currentUser.username);
                    enterChat();
                } catch (e) {
                    console.error('Failed to parse saved user:', e);
                    localStorage.removeItem('currentUser');
                }
            }
        });

        // Toggle between login and signup
        document.getElementById('show-signup').addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('login-form').classList.add('hidden');
            document.querySelector('.toggle-auth').classList.add('hidden');
            document.getElementById('signup-form').classList.remove('hidden');
            document.getElementById('show-login-link').classList.remove('hidden');
        });

        document.getElementById('show-login').addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('signup-form').classList.add('hidden');
            document.getElementById('show-login-link').classList.add('hidden');
            document.getElementById('login-form').classList.remove('hidden');
            document.querySelector('.toggle-auth').classList.remove('hidden');
        });

        // Login
        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('login-username').value.trim();
            const password = document.getElementById('login-password').value;

            try {
                const response = await fetch(`${API_URL}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, secret: password })
                });

                if (response.ok) {
                    currentUser = await response.json();
                    localStorage.setItem('currentUser', JSON.stringify(currentUser));
                    showError('login', '');
                    enterChat();
                } else {
                    const error = await response.json();
                    showError('login', error.error || 'Invalid credentials');
                }
            } catch (e) {
                console.error(e);
                showError('login', 'Server connection failed');
            }
        });

        // Signup
        document.getElementById('signup-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('signup-username').value.trim();
            const email = document.getElementById('signup-email').value.trim();
            const firstName = document.getElementById('signup-firstname').value.trim();
            const lastName = document.getElementById('signup-lastname').value.trim();
            const password = document.getElementById('signup-password').value;

            try {
                const response = await fetch(`${API_URL}/signup`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, email, firstName, lastName, secret: password })
                });

                if (response.ok) {
                    currentUser = await response.json();
                    localStorage.setItem('currentUser', JSON.stringify(currentUser));
                    showError('signup', '');
                    enterChat();
                } else {
                    const error = await response.json();
                    showError('signup', error.error || 'Signup failed');
                }
            } catch (e) {
                console.error(e);
                showError('signup', 'Server connection failed');
            }
        });

        function showError(type, message) {
            const errorDiv = document.getElementById(`${type}-error`);
            if (message) {
                errorDiv.textContent = message;
                errorDiv.classList.remove('hidden');
            } else {
                errorDiv.classList.add('hidden');
            }
        }


        function enterChat() {
            document.getElementById('auth-page').style.display = 'none';
            document.getElementById('chat-app').classList.add('active');
            document.getElementById('current-username').textContent = currentUser.username;

            // Connect to WebSocket
            const socket = new SockJS(`${API_URL}/ws?username=${currentUser.username}`);
            stompClient = Stomp.over(socket);
            stompClient.connect({}, onConnected, onError);
        }

        function onConnected() {
            console.log('âœ… Connected to WebSocket');
            stompClient.subscribe('/user/queue/private', onMessageReceived);
            // Load users and pending requests
            loadUsers();
            loadPendingRequests();
            fetchMyGroups();
        }

        function onError(error) {
            console.error('WebSocket error:', error);
            alert('Could not connect to chat server');
        }

        function onMessageReceived(payload) {
            const message = JSON.parse(payload.body);
            const otherUser = message.sender === currentUser.username ? message.recipient : message.sender;

            if (selectedRecipient === otherUser) {
                displayMessage(message);
            }
        }

        // Friend Request Functions
        function toggleFriendRequests() {
            const panel = document.getElementById('requests-panel');
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        }

        async function loadPendingRequests() {
            try {
                const response = await fetch(`${API_URL}/friends/requests/pending?username=${currentUser.username}`);
                if (response.ok) {
                    const requests = await response.json();
                    const badge = document.getElementById('request-badge');
                    const list = document.getElementById('pending-requests-list');

                    if (requests.length > 0) {
                        badge.textContent = requests.length;
                        badge.style.display = 'flex';

                        list.innerHTML = requests.map(req => `
    <div
        style="background: white; padding: 8px; border-radius: 6px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
        <span style="font-weight: 600; font-size: 13px;">${req.sender}</span>
        <div style="display: flex; gap: 5px;">
            <button onclick="acceptRequest(${req.id})"
                style="background: #4ade80; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;">Accept</button>
            <button onclick="rejectRequest(${req.id})"
                style="background: #ef4444; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;">Reject</button>
        </div>
    </div>
    `).join('');
                    } else {
                        badge.style.display = 'none';
                        list.innerHTML = '<div style="color: #999; font-size: 12px; text-align: center;">No pending requests</div>';
                    }
                }
            } catch (e) {
                console.error("Error loading requests:", e);
            }
        }

        async function sendFriendRequest(receiver) {
            try {
                const response = await fetch(`${API_URL}/friends/request`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sender: currentUser.username, receiver: receiver })
                });

                if (response.ok) {
                    alert(`âœ… Friend request sent to ${receiver}!`);
                    loadUsers(); // Refresh to update status
                } else {
                    const error = await response.json();
                    alert(`âŒ ${error.error || 'Failed to send request'}`);
                }
            } catch (e) {
                console.error(e);
                alert('Connection error');
            }
        }

        async function acceptRequest(id) {
            try {
                await fetch(`${API_URL}/friends/accept/${id}`, { method: 'POST' });
                loadPendingRequests();
                loadUsers();
                loadFriendsList();
            } catch (e) {
                console.error(e);
            }
        }

        async function rejectRequest(id) {
            try {
                await fetch(`${API_URL}/friends/reject/${id}`, { method: 'POST' });
                loadPendingRequests();
            } catch (e) {
                console.error(e);
            }
        }

        let friendsList = [];
        async function loadFriendsList() {
            try {
                const response = await fetch(`${API_URL}/friends/list?username=${currentUser.username}`);
                if (response.ok) {
                    friendsList = await response.json();
                }
            } catch (e) {
                console.error(e);
            }
        }

        async function loadUsers() {
            try {
                // Also get friends list to check status first
                await loadFriendsList();

                const response = await fetch(`${API_URL}/users/search?username=`);
                const users = await response.json();

                allUsers = users.filter(u => u.username !== currentUser.username);
                displayUsers(allUsers);
            } catch (e) {
                console.error('Load users error:', e);
                document.getElementById('users-list').innerHTML = '<div class="empty-state">Error loading users</div>';
            }
        }

        function displayUsers(users) {
            const usersList = document.getElementById('users-list');

            if (users.length === 0) {
                usersList.innerHTML = '<div class="empty-state">No users found</div>';
                return;
            }

            usersList.innerHTML = '';
            users.forEach(user => {
                const isFriend = friendsList.includes(user.username);
                let statusHtml = '';

                if (isFriend) {
                    statusHtml = '<span style="color: #4ade80; font-size: 12px; font-weight: 600;">Friend âœ…</span>';
                } else {
                    // Start of render_diff logic adaptation:
                    // Add friend button that stops propagation so we don't select the user
                    statusHtml = `<button onclick="sendFriendRequest('${user.username}'); event.stopPropagation();"
        style="background: #3b82f6; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;">Add
        Friend</button>`;
                }

                const userItem = document.createElement('div');
                userItem.className = 'user-item';
                userItem.id = `user-${user.username}`;
                userItem.onclick = () => selectUser(user.username);

                userItem.innerHTML = `
    <div class="user-avatar">${user.username[0].toUpperCase()}</div>
    <div class="user-info">
        <div class="user-name">${user.username}</div>
        <div class="status-row"
            style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
            <div class="user-status">Online</div>
            <div>${statusHtml}</div>
        </div>
    </div>
    `;
                usersList.appendChild(userItem);
            });
        }

        function filterUsers(query) {
            if (!query) {
                displayUsers(allUsers);
                return;
            }

            const filtered = allUsers.filter(user =>
                user.username.toLowerCase().includes(query.toLowerCase())
            );
            displayUsers(filtered);
        }

        async function fetchMyGroups() {
            try {
                const response = await fetch(`${API_URL}/groups/user/${currentUser.username}`);
                if (response.ok) {
                    myGroups = await response.json();
                    displayGroups(myGroups);
                    // Subscribe to existing groups if connected
                    if (stompClient && stompClient.connected) {
                        myGroups.forEach(group => {
                            // Idempotent subscribe could be handled by STOMP lib or check if already subbed
                            // For simplicity, just subscribe (STOMP usually handles duplicates or we can ignore)
                            stompClient.subscribe(`/topic/group.${group.id}`, onGroupMessageReceived);
                        });
                    }
                }
            } catch (e) {
                console.error('Error fetching groups:', e);
            }
        }

        function displayGroups(groups) {
            const list = document.getElementById('groups-list');
            if (groups.length === 0) {
                list.innerHTML = '<div class="empty-state">No groups found</div>';
                return;
            }
            list.innerHTML = '';
            groups.forEach(group => {
                const item = document.createElement('div');
                item.className = 'user-item';
                item.id = `group-${group.id}`;
                item.onclick = () => selectGroup(group);
                item.innerHTML = `
    <div class="user-avatar" style="background: #e11d48">#</div>
    <div class="user-info">
        <div class="user-name">${group.name}</div>
        <div class="user-status">Created by ${group.createdBy}</div>
    </div>
    `;
                list.appendChild(item);
            });
        }

        function exitChatView() {
            document.getElementById('chat-app').classList.remove('mobile-chat-active');
            selectedRecipient = null;
            activeGroupId = null;
        }

        async function selectUser(username) {
            selectedRecipient = username;
            activeGroupId = null; // Reset activeGroupId when selecting a user

            // Enable Mobile View
            document.getElementById('chat-app').classList.add('mobile-chat-active');

            // Update header
            document.getElementById('chat-name').textContent = username;
            document.getElementById('chat-status').textContent = 'Online';
            document.getElementById('chat-avatar').textContent = username[0].toUpperCase();
            document.getElementById('chat-avatar').style.background = '#0ea5e9'; // Default user avatar color

            // Check if friend to enable/disable input
            const isFriend = friendsList.includes(username);
            const input = document.getElementById('message-input');
            const btn = document.getElementById('send-btn');

            if (isFriend) {
                input.disabled = false;
                input.placeholder = "Type a message...";
                btn.disabled = false;
                btn.style.opacity = "1";
                btn.style.cursor = "pointer";
            } else {
                input.disabled = true;
                input.placeholder = "Accepted friend request required to chat";
                btn.disabled = true;
                btn.style.opacity = "0.5";
                btn.style.cursor = "not-allowed";
            }

            // Clear messages
            document.getElementById('messages').innerHTML = '';

            // Highlight selected user
            document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));
            const userEl = document.getElementById(`user-${username}`);
            if (userEl) userEl.classList.add('active');

            // Load chat history
            loadChatHistory(username);
        }

        function selectGroup(group) {
            selectedRecipient = null; // Clear individual recipient
            activeGroupId = group.id;

            // Enable Mobile View
            document.getElementById('chat-app').classList.add('mobile-chat-active');

            // Update header
            document.getElementById('chat-name').textContent = group.name;
            document.getElementById('chat-status').textContent = 'Group Chat';
            document.getElementById('chat-avatar').textContent = '#';
            document.getElementById('chat-avatar').style.background = '#e11d48';

            const input = document.getElementById('message-input');
            const btn = document.getElementById('send-btn');
            input.disabled = false;
            input.placeholder = "Message group...";
            btn.disabled = false;
            btn.style.opacity = "1";
            btn.style.cursor = "pointer";

            // Highlight
            document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));
            document.getElementById(`group-${group.id}`).classList.add('active');

            // Load history
            loadGroupHistory(group.id);
        }

        async function loadGroupHistory(groupId) {
            try {
                const response = await fetch(`${API_URL}/groups/${groupId}/messages`);
                if (response.ok) {
                    const messages = await response.json();
                    document.getElementById('messages').innerHTML = ''; // Clear
                    messages.forEach(displayMessage);
                }
            } catch (e) {
                console.error('Error loading group history:', e);
            }
        }

        function onGroupMessageReceived(payload) {
            const message = JSON.parse(payload.body);
            // If viewing this group, display it
            if (activeGroupId === message.groupId) {
                displayMessage(message);
            }
        }


        async function loadChatHistory(contact) {
            try {
                const response = await fetch(`${API_URL}/messages/${contact}?currentUser=${currentUser.username}`);
                if (response.ok) {
                    const messages = await response.json();
                    console.log(`Loaded ${messages.length} messages`);
                    messages.forEach(displayMessage);
                }
            } catch (e) {
                console.error('Error loading history:', e);
            }
        }

        // Send message
        document.getElementById('message-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const messageContent = document.getElementById('message-input').value.trim();

            if (messageContent && stompClient) {
                if (activeGroupId) {
                    // Send Group Message
                    const chatMessage = {
                        sender: currentUser.username,
                        groupId: activeGroupId,
                        content: messageContent,
                        type: 'CHAT'
                    };
                    stompClient.send("/app/chat.group", {}, JSON.stringify(chatMessage));
                } else if (selectedRecipient) {
                    // Send Private Message
                    const chatMessage = {
                        sender: currentUser.username,
                        recipient: selectedRecipient,
                        content: messageContent,
                        type: 'CHAT',
                        timestamp: Date.now()
                    };
                    stompClient.send("/app/chat.private", {}, JSON.stringify(chatMessage));
                }
                document.getElementById('message-input').value = '';
            }
        });

        function displayMessage(message) {
            const messagesDiv = document.getElementById('messages');

            const messageDiv = document.createElement('div');
            messageDiv.className = 'message';
            if (message.sender === currentUser.username) {
                messageDiv.classList.add('own');
            }

            const time = new Date(message.timestamp).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
            });

            messageDiv.innerHTML = `
    <div class="message-content">
        <div class="message-sender">${message.sender}</div>
        ${escapeHtml(message.content)}
        <div class="message-time">${time}</div>
    </div>
    `;

            messagesDiv.appendChild(messageDiv);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        async function refreshData() {
            const btn = document.getElementById('refresh-btn');
            btn.style.transform = 'rotate(360deg)';

            console.log('ðŸ”„ Refreshing data...');

            try {
                // Reload users and friend status
                await loadFriendsList();
                await loadUsers();
                await loadPendingRequests();

                // If chat is open, refresh history
                if (selectedRecipient) {
                    loadChatHistory(selectedRecipient);
                }

                // Check connection
                if (!stompClient || !stompClient.connected) {
                    console.log('ðŸ”„ Reconnecting WebSocket...');
                    enterChat();
                }

            } catch (e) {
                console.error('Refresh failed:', e);
            } finally {
                setTimeout(() => {
                    btn.style.transform = 'none';
                }, 1000);
            }
        }

        function openCreateGroupModal() {
            document.getElementById('create-group-modal').style.display = 'flex';
            const list = document.getElementById('group-user-select');
            list.innerHTML = '';

            // Filter out self
            const users = allUsers;

            users.forEach(user => {
                const div = document.createElement('div');
                div.className = 'select-item';
                div.innerHTML = `
    <input type="checkbox" value="${user.username}" id="chk-${user.username}">
    <label for="chk-${user.username}" style="cursor:pointer">${user.username}</label>
    `;
                // Allow clicking row to toggle
                div.onclick = (e) => {
                    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'LABEL') {
                        const chk = document.getElementById(`chk-${user.username}`);
                        chk.checked = !chk.checked;
                    }
                };
                list.appendChild(div);
            });
        }

        async function submitCreateGroup() {
            const name = document.getElementById('group-name-input').value.trim();
            if (!name) { alert('Please enter a group name'); return; }

            const members = [];
            document.querySelectorAll('#group-user-select input:checked').forEach(chk => {
                members.push(chk.value);
            });
            members.push(currentUser.username); // Add self

            try {
                const response = await fetch(`${API_URL}/groups/create`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: name, createdBy: currentUser.username, members: members })
                });

                if (response.ok) {
                    document.getElementById('create-group-modal').style.display = 'none';
                    document.getElementById('group-name-input').value = '';
                    fetchMyGroups();
                    alert('Group created successfully!');
                } else {
                    try {
                        const errorData = await response.json();
                        alert('Failed to create group: ' + (errorData.error || 'Unknown error'));
                    } catch (parseError) {
                        alert('Failed to create group: Server returned ' + response.status);
                    }
                }
            } catch (e) {
                console.error(e);
                alert('Connection error: ' + e.message);
            }
        }

        function logout() {
            // Disconnect WebSocket
            if (stompClient) {
                stompClient.disconnect();
            }
            localStorage.removeItem('currentUser');
            sessionStorage.removeItem('currentUser');
            currentUser = null;
            document.getElementById('chat-app').classList.remove('active');
            document.getElementById('auth-page').style.display = 'block';
            document.getElementById('login-form').reset();

            // Clear location reload to prevent re-login
            window.location.reload();
        }

        // Admin Reset Functions
        function showAdminReset() {
            document.getElementById('admin-modal').style.display = 'flex';
            document.getElementById('admin-secret').value = '';
            document.getElementById('admin-error').style.display = 'none';
        }

        function hideAdminReset() {
            document.getElementById('admin-modal').style.display = 'none';
        }

        async function executeAdminReset(type) {
            const secret = document.getElementById('admin-secret').value.trim();
            const errorDiv = document.getElementById('admin-error');

            if (!secret) {
                errorDiv.textContent = 'Please enter admin secret code';
                errorDiv.style.display = 'block';
                return;
            }

            // Client-side partial validation for immediate feedback
            const EXPECTED_SECRET = "boxbi@#$%&123";

            if (type === 'local') {
                if (secret !== EXPECTED_SECRET) {
                    errorDiv.textContent = 'Invalid secret code';
                    errorDiv.style.display = 'block';
                    return;
                }

                if (!confirm('âš ï¸ This will delete all saved login sessions and local preferences. Are you sure?')) {
                    return;
                }

                localStorage.clear();
                sessionStorage.clear();
                hideAdminReset();
                alert('âœ… Local app data has been cleared.');
                location.reload();
                return;
            }

            // DB Reset
            if (!confirm('âš ï¸ WARNING: This will delete ALL users and messages permanently. Are you sure?')) {
                return;
            }

            try {
                const response = await fetch(`${API_URL}/admin/reset`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ secret })
                });

                if (response.ok) {
                    alert('âœ… System has been reset successfully');
                    localStorage.removeItem('currentUser');
                    sessionStorage.removeItem('currentUser');
                    location.reload();
                } else {
                    const error = await response.text();
                    errorDiv.textContent = 'Invalid secret code';
                    errorDiv.style.display = 'block';
                }
            } catch (e) {
                console.error(e);
                errorDiv.textContent = 'Connection error';
                errorDiv.style.display = 'block';
            }
        }
    </script>
</body>

</html>

`


## File: public\style.css
`$lang

/* Global Defaults */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

:root {
    --primary-color: #0066ff;
    --primary-dark: #0052cc;
    --bg-color: #e0e7ff;
    --white: #ffffff;
    --text-main: #1a1a1a;
    --text-secondary: #666666;
    --border-color: #e0e0e0;
    --danger-color: #dc3545;
    --success-color: #4ade80;
}

body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    background: url('background.png') no-repeat center center fixed;
    background-size: cover;
    height: 100vh;
    /* Mobile viewport fix */
    height: 100dvh;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow: hidden;
    /* Prevent body scroll */
}

/* Responsive Improvements */
@media (max-width: 768px) {
    body {
        padding: 0;
        align-items: flex-start;
    }

    .chat-app {
        width: 100%;
        height: 100dvh;
        /* Full screen on mobile */
        max-width: none;
        border-radius: 0;
        border: none;
        flex-direction: column;
    }

    .users-sidebar {
        width: 100%;
        flex: 1;
        display: flex;
    }

    .chat-area {
        width: 100%;
        height: 100%;
        position: absolute;
        top: 0;
        left: 0;
        background: white;
        transform: translateX(100%);
        transition: transform 0.3s ease-in-out;
        z-index: 20;
    }

    /* When chat is active, slide it in */
    .chat-app.mobile-chat-active .chat-area {
        transform: translateX(0);
    }

    /* Hide sidebar visually/interactively when chat is open to avoid scrolling issues */
    .chat-app.mobile-chat-active .users-sidebar {
        display: none;
    }

    .back-button {
        display: flex !important;
    }

    /* Touch targets */
    .btn,
    .tab-btn,
    .user-item,
    button {
        min-height: 44px;
    }
}

/* Auth Container */
.auth-page {
    background: white;
    padding: 40px;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    width: 400px;
    max-width: 90%;
    border: 2px solid #4f46e5;
    /* Distinct border for local */
}

.auth-page h1 {
    font-size: 24px;
    font-weight: 600;
    margin-bottom: 8px;
    color: #1a1a1a;
}

.auth-page p {
    color: #666;
    margin-bottom: 24px;
    font-size: 14px;
}

.form-group {
    margin-bottom: 16px;
}

.form-group label {
    display: block;
    margin-bottom: 6px;
    font-size: 13px;
    font-weight: 500;
    color: #333;
}

.form-group input {
    width: 100%;
    padding: 10px 12px;
    border: 1.5px solid #e0e0e0;
    border-radius: 8px;
    font-size: 14px;
    transition: border 0.2s;
    font-family: 'Inter', sans-serif;
}

.form-group input:focus {
    outline: none;
    border-color: #0066ff;
}

.btn {
    width: 100%;
    padding: 12px;
    background: #0066ff;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
}

.btn:hover {
    background: #0052cc;
}

.toggle-auth {
    text-align: center;
    margin-top: 16px;
    font-size: 13px;
    color: #666;
}

.toggle-auth a {
    color: #0066ff;
    text-decoration: none;
    font-weight: 500;
}

.error {
    color: #d32f2f;
    font-size: 12px;
    margin-top: 8px;
}

.hidden {
    display: none !important;
}

/* Chat Container */
.chat-app {
    display: none;
    width: 100%;
    max-width: 1200px;
    height: 90vh;
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    overflow: hidden;
    border: 2px solid #4f46e5;
    /* Distinct border for local */
}

.chat-app.active {
    display: flex;
}

/* User List Sidebar */
.users-sidebar {
    width: 300px;
    background: #fafafa;
    border-right: 1px solid #e0e0e0;
    display: flex;
    flex-direction: column;
}

.sidebar-header {
    padding: 20px;
    background: white;
    border-bottom: 1px solid #e0e0e0;
}

.sidebar-header h2 {
    font-size: 18px;
    font-weight: 600;
    color: #1a1a1a;
    margin-bottom: 4px;
}

.sidebar-header p {
    font-size: 13px;
    color: #666;
}

.search-box {
    padding: 12px 20px;
}

.search-box input {
    width: 100%;
    padding: 8px 12px;
    border: 1.5px solid #e0e0e0;
    border-radius: 8px;
    font-size: 13px;
    font-family: 'Inter', sans-serif;
}

.search-box input:focus {
    outline: none;
    border-color: #0066ff;
}

.users-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
}

.user-item {
    padding: 12px 16px;
    margin-bottom: 4px;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.2s;
    display: flex;
    align-items: center;
    gap: 12px;
}

.user-item:hover {
    background: #f0f0f0;
}

.user-item.active {
    background: #e3f2fd;
}

.user-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 600;
    font-size: 14px;
    flex-shrink: 0;
}

.user-info {
    flex: 1;
    min-width: 0;
}

.user-name {
    font-size: 14px;
    font-weight: 500;
    color: #1a1a1a;
}

.user-status {
    font-size: 12px;
    color: #28a745;
    margin-top: 2px;
}

.empty-state {
    text-align: center;
    padding: 40px 20px;
    color: #999;
}

/* Chat Area */
.chat-area {
    flex: 1;
    display: flex;
    flex-direction: column;
}

.chat-header {
    padding: 20px 24px;
    background: white;
    border-bottom: 1px solid #e0e0e0;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.chat-header-info {
    display: flex;
    align-items: center;
    gap: 12px;
}

.chat-header h3 {
    font-size: 16px;
    font-weight: 600;
    color: #1a1a1a;
}

.chat-header .status {
    font-size: 12px;
    color: #28a745;
}

.logout-btn {
    padding: 8px 16px;
    background: #f5f5f5;
    color: #333;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
}

.logout-btn:hover {
    background: #e0e0e0;
}

.messages-container {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
    background: #f9f9f9;
}

.welcome-screen {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #999;
}

.welcome-screen h2 {
    font-size: 20px;
    color: #666;
    margin-bottom: 8px;
}

.message {
    display: flex;
    margin-bottom: 16px;
    animation: fadeIn 0.3s;
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(10px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.message.own {
    justify-content: flex-end;
}

.message-content {
    max-width: 60%;
    padding: 10px 14px;
    border-radius: 12px;
    font-size: 14px;
    line-height: 1.5;
}

.message:not(.own) .message-content {
    background: white;
    color: #1a1a1a;
    border-bottom-left-radius: 4px;
}

.message.own .message-content {
    background: #0066ff;
    color: white;
    border-bottom-right-radius: 4px;
}

.message-sender {
    font-size: 11px;
    font-weight: 600;
    margin-bottom: 4px;
    opacity: 0.8;
}

.message-time {
    font-size: 11px;
    margin-top: 4px;
    opacity: 0.7;
}

.chat-input {
    padding: 20px 24px;
    background: white;
    border-top: 1px solid #e0e0e0;
}

.chat-input-form {
    display: flex;
    gap: 12px;
}

.chat-input-form input {
    flex: 1;
    padding: 12px 16px;
    border: 1.5px solid #e0e0e0;
    border-radius: 24px;
    font-size: 14px;
    font-family: 'Inter', sans-serif;
}

.chat-input-form input:focus {
    outline: none;
    border-color: #0066ff;
}

.send-btn {
    padding: 0 24px;
    background: #0066ff;
    color: white;
    border: none;
    border-radius: 24px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
}

.send-btn:hover {
    background: #0052cc;
}

.send-btn:disabled {
    background: #ccc;
    cursor: not-allowed;
}

/* Tabs */
.sidebar-tabs {
    display: flex;
    border-bottom: 1px solid #e0e0e0;
    background: white;
}

.tab-btn {
    flex: 1;
    padding: 12px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    font-weight: 500;
    color: #666;
    cursor: pointer;
    transition: all 0.2s;
}

.tab-btn.active {
    color: #0066ff;
    border-bottom-color: #0066ff;
    background: #f0f7ff;
}

.tab-content {
    display: none;
    flex: 1;
    overflow-y: auto;
    flex-direction: column;
}

.tab-content.active {
    display: flex;
}

/* Modal */
.modal {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 10000;
    justify-content: center;
    align-items: center;
}

.modal-content {
    background: white;
    padding: 24px;
    border-radius: 12px;
    width: 400px;
    max-width: 90%;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
}

.multi-select-list {
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    max-height: 200px;
    overflow-y: auto;
    margin: 10px 0;
    padding: 8px;
}

.select-item {
    display: flex;
    align-items: center;
    padding: 8px;
    gap: 10px;
    cursor: pointer;
}

.select-item:hover {
    background: #f5f5f5;
}

`


## File: local_test.html
`$lang

<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Boxbi Messenger (LOCAL TEST)</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background: #e0e7ff;
            /* Light blue background for local test distinction */
            height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
        }

        /* Auth Container */
        .auth-page {
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            width: 400px;
            max-width: 90%;
            border: 2px solid #4f46e5;
            /* Distinct border for local */
        }

        .auth-page h1 {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 8px;
            color: #1a1a1a;
        }

        .auth-page p {
            color: #666;
            margin-bottom: 24px;
            font-size: 14px;
        }

        .form-group {
            margin-bottom: 16px;
        }

        .form-group label {
            display: block;
            margin-bottom: 6px;
            font-size: 13px;
            font-weight: 500;
            color: #333;
        }

        .form-group input {
            width: 100%;
            padding: 10px 12px;
            border: 1.5px solid #e0e0e0;
            border-radius: 8px;
            font-size: 14px;
            transition: border 0.2s;
            font-family: 'Inter', sans-serif;
        }

        .form-group input:focus {
            outline: none;
            border-color: #0066ff;
        }

        .btn {
            width: 100%;
            padding: 12px;
            background: #0066ff;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.2s;
        }

        .btn:hover {
            background: #0052cc;
        }

        .toggle-auth {
            text-align: center;
            margin-top: 16px;
            font-size: 13px;
            color: #666;
        }

        .toggle-auth a {
            color: #0066ff;
            text-decoration: none;
            font-weight: 500;
        }

        .error {
            color: #d32f2f;
            font-size: 12px;
            margin-top: 8px;
        }

        .hidden {
            display: none !important;
        }

        /* Chat Container */
        .chat-app {
            display: none;
            width: 100%;
            max-width: 1200px;
            height: 90vh;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            overflow: hidden;
            border: 2px solid #4f46e5;
            /* Distinct border for local */
        }

        .chat-app.active {
            display: flex;
        }

        /* User List Sidebar */
        .users-sidebar {
            width: 300px;
            background: #fafafa;
            border-right: 1px solid #e0e0e0;
            display: flex;
            flex-direction: column;
        }

        .sidebar-header {
            padding: 20px;
            background: white;
            border-bottom: 1px solid #e0e0e0;
        }

        .sidebar-header h2 {
            font-size: 18px;
            font-weight: 600;
            color: #1a1a1a;
            margin-bottom: 4px;
        }

        .sidebar-header p {
            font-size: 13px;
            color: #666;
        }

        .search-box {
            padding: 12px 20px;
        }

        .search-box input {
            width: 100%;
            padding: 8px 12px;
            border: 1.5px solid #e0e0e0;
            border-radius: 8px;
            font-size: 13px;
            font-family: 'Inter', sans-serif;
        }

        .search-box input:focus {
            outline: none;
            border-color: #0066ff;
        }

        .users-list {
            flex: 1;
            overflow-y: auto;
            padding: 8px;
        }

        .user-item {
            padding: 12px 16px;
            margin-bottom: 4px;
            border-radius: 8px;
            cursor: pointer;
            transition: background 0.2s;
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .user-item:hover {
            background: #f0f0f0;
        }

        .user-item.active {
            background: #e3f2fd;
        }

        .user-avatar {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 600;
            font-size: 14px;
            flex-shrink: 0;
        }

        .user-info {
            flex: 1;
            min-width: 0;
        }

        .user-name {
            font-size: 14px;
            font-weight: 500;
            color: #1a1a1a;
        }

        .user-status {
            font-size: 12px;
            color: #28a745;
            margin-top: 2px;
        }

        .empty-state {
            text-align: center;
            padding: 40px 20px;
            color: #999;
        }

        /* Chat Area */
        .chat-area {
            flex: 1;
            display: flex;
            flex-direction: column;
        }

        .chat-header {
            padding: 20px 24px;
            background: white;
            border-bottom: 1px solid #e0e0e0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .chat-header-info {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .chat-header h3 {
            font-size: 16px;
            font-weight: 600;
            color: #1a1a1a;
        }

        .chat-header .status {
            font-size: 12px;
            color: #28a745;
        }

        .logout-btn {
            padding: 8px 16px;
            background: #f5f5f5;
            color: #333;
            border: none;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.2s;
        }

        .logout-btn:hover {
            background: #e0e0e0;
        }

        .messages-container {
            flex: 1;
            overflow-y: auto;
            padding: 24px;
            background: #f9f9f9;
        }

        .welcome-screen {
            height: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: #999;
        }

        .welcome-screen h2 {
            font-size: 20px;
            color: #666;
            margin-bottom: 8px;
        }

        .message {
            display: flex;
            margin-bottom: 16px;
            animation: fadeIn 0.3s;
        }

        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: translateY(10px);
            }

            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .message.own {
            justify-content: flex-end;
        }

        .message-content {
            max-width: 60%;
            padding: 10px 14px;
            border-radius: 12px;
            font-size: 14px;
            line-height: 1.5;
        }

        .message:not(.own) .message-content {
            background: white;
            color: #1a1a1a;
            border-bottom-left-radius: 4px;
        }

        .message.own .message-content {
            background: #0066ff;
            color: white;
            border-bottom-right-radius: 4px;
        }

        .message-sender {
            font-size: 11px;
            font-weight: 600;
            margin-bottom: 4px;
            opacity: 0.8;
        }

        .message-time {
            font-size: 11px;
            margin-top: 4px;
            opacity: 0.7;
        }

        .chat-input {
            padding: 20px 24px;
            background: white;
            border-top: 1px solid #e0e0e0;
        }

        .chat-input-form {
            display: flex;
            gap: 12px;
        }

        .chat-input-form input {
            flex: 1;
            padding: 12px 16px;
            border: 1.5px solid #e0e0e0;
            border-radius: 24px;
            font-size: 14px;
            font-family: 'Inter', sans-serif;
        }

        .chat-input-form input:focus {
            outline: none;
            border-color: #0066ff;
        }

        .send-btn {
            padding: 0 24px;
            background: #0066ff;
            color: white;
            border: none;
            border-radius: 24px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.2s;
        }

        .send-btn:hover {
            background: #0052cc;
        }

        .send-btn:disabled {
            background: #ccc;
            cursor: not-allowed;
        }
    </style>
</head>

<body>

    <!-- Auth Page -->
    <div id="auth-page" class="auth-page">
        <h1>ðŸ’¬ Boxbi Messenger (LOCAL)</h1>
        <p>Connected to localhost:8080</p>

        <!-- Login Form -->
        <form id="login-form">
            <div class="form-group">
                <label for="login-username">Username</label>
                <input type="text" id="login-username" required autocomplete="username">
            </div>
            <div class="form-group">
                <label for="login-password">Password</label>
                <input type="password" id="login-password" required autocomplete="current-password">
            </div>
            <button type="submit" class="btn">Sign In</button>
            <div class="error hidden" id="login-error"></div>
        </form>

        <div class="toggle-auth">
            Don't have an account? <a href="#" id="show-signup">Sign up</a>
        </div>

        <!-- Signup Form -->
        <form id="signup-form" class="hidden">
            <div class="form-group">
                <label for="signup-username">Username</label>
                <input type="text" id="signup-username" required>
            </div>
            <div class="form-group">
                <label for="signup-email">Email</label>
                <input type="email" id="signup-email" required>
            </div>
            <div class="form-group">
                <label for="signup-firstname">First Name</label>
                <input type="text" id="signup-firstname" required>
            </div>
            <div class="form-group">
                <label for="signup-lastname">Last Name</label>
                <input type="text" id="signup-lastname" required>
            </div>
            <div class="form-group">
                <label for="signup-password">Password</label>
                <input type="password" id="signup-password" required>
            </div>
            <button type="submit" class="btn">Sign Up</button>
            <div class="error hidden" id="signup-error"></div>
        </form>

        <div class="toggle-auth hidden" id="show-login-link">
            Have an account? <a href="#" id="show-login">Sign in</a>
        </div>

        <!-- Admin Reset Button -->
        <div style="text-align: center; margin-top: 20px;">
            <button onclick="showAdminReset()"
                style="padding: 8px 16px; background: #dc3545; color: white; border: none; border-radius: 6px; font-size: 12px; cursor: pointer; opacity: 0.7;">Admin
                Reset</button>
        </div>
    </div>

    <!-- Admin Reset Modal -->
    <div id="admin-modal"
        style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999; justify-content: center; align-items: center;">
        <div style="background: white; padding: 30px; border-radius: 12px; max-width: 400px; width: 90%;">
            <h2 style="margin: 0 0 10px 0; font-size: 20px;">ðŸ” Admin Reset</h2>
            <p style="color: #666; font-size: 14px; margin-bottom: 20px;">Enter admin secret code to reset all data</p>
            <input type="password" id="admin-secret" placeholder="Enter secret code"
                style="width: 100%; padding: 10px; border: 1.5px solid #e0e0e0; border-radius: 8px; font-size: 14px; margin-bottom: 16px;">
            <div id="admin-error" style="color: #d32f2f; font-size: 12px; margin-bottom: 12px; display: none;"></div>
            <div style="display: flex; gap: 12px;">
                <button onclick="hideAdminReset()"
                    style="flex: 1; padding: 10px; background: #f5f5f5; color: #333; border: none; border-radius: 8px; font-size: 14px; cursor: pointer;">Cancel</button>
                <button onclick="executeAdminReset()"
                    style="flex: 1; padding: 10px; background: #dc3545; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;">Reset
                    All Data</button>
            </div>
        </div>
    </div>

    <!-- Chat App -->
    <div id="chat-app" class="chat-app">
        <!-- Users Sidebar -->
        <div class="users-sidebar">
            <div class="sidebar-header">
                <h2 id="current-username">Loading...</h2>
                <div style="display: flex; gap: 10px; align-items: center;">
                    <div style="font-size: 12px; color: #4ade80;">Online</div>
                    <button onclick="toggleFriendRequests()"
                        style="position: relative; background: none; border: none; font-size: 20px; cursor: pointer;"
                        title="Friend Requests">
                        ðŸ‘¥
                        <span id="request-badge"
                            style="position: absolute; top: -5px; right: -5px; background: #dc3545; color: white; border-radius: 50%; width: 15px; height: 15px; font-size: 10px; display: none; justify-content: center; align-items: center;">0</span>
                    </button>
                    <button onclick="logout()" style="background: none; border: none; font-size: 20px; cursor: pointer;"
                        title="Logout">ðŸšª</button>
                </div>
            </div>

            <!-- Friend Requests Panel (Hidden by default) -->
            <div id="requests-panel"
                style="display: none; background: #f8f9fa; border-bottom: 1px solid #eee; padding: 10px;">
                <h3 style="margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase; color: #666;">Friend Requests
                </h3>
                <div id="pending-requests-list" style="max-height: 150px; overflow-y: auto;">
                    <div style="color: #999; font-size: 12px; text-align: center;">No pending requests</div>
                </div>
            </div>

            <div class="search-box">
                <input type="text" id="user-search" placeholder="Search users..." onkeyup="filterUsers(this.value)">
            </div>
            <div class="users-list" id="users-list">
                <div class="empty-state">Loading users...</div>
            </div>
        </div>

        <!-- Chat Area -->
        <div class="chat-area">
            <div class="chat-header">
                <div class="chat-header-info">
                    <div class="user-avatar" id="chat-avatar">?</div>
                    <div>
                        <h3 id="chat-name">Select a user to chat</h3>
                        <div class="status" id="chat-status"></div>
                    </div>
                </div>
                <button class="logout-btn" id="logout-btn">Logout</button>
            </div>

            <div class="messages-container" id="messages">
                <div class="welcome-screen">
                    <h2>ðŸ‘‹ Welcome!</h2>
                    <p>Select a user from the left to start chatting</p>
                </div>
            </div>

            <div class="chat-input">
                <form class="chat-input-form" id="message-form">
                    <input type="text" id="message-input" placeholder="Type a message..." autocomplete="off" disabled>
                    <button type="submit" class="send-btn" id="send-btn" disabled>Send</button>
                </form>
            </div>
        </div>
    </div>

    <script src="https://cdn.jsdelivr.net/npm/sockjs-client@1/dist/sockjs.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/stompjs@2.3.3/lib/stomp.min.js"></script>

    <script>
        // LOCALHOST API URL
        const API_URL = 'http://localhost:8080';

        let stompClient = null;
        let currentUser = null;
        let selectedRecipient = null;
        let allUsers = [];

        // Toggle between login and signup
        document.getElementById('show-signup').addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('login-form').classList.add('hidden');
            document.querySelector('.toggle-auth').classList.add('hidden');
            document.getElementById('signup-form').classList.remove('hidden');
            document.getElementById('show-login-link').classList.remove('hidden');
        });

        document.getElementById('show-login').addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('signup-form').classList.add('hidden');
            document.getElementById('show-login-link').classList.add('hidden');
            document.getElementById('login-form').classList.remove('hidden');
            document.querySelector('.toggle-auth').classList.remove('hidden');
        });

        // Login
        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('login-username').value.trim();
            const password = document.getElementById('login-password').value;

            try {
                const response = await fetch(`${API_URL}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, secret: password })
                });

                if (response.ok) {
                    currentUser = await response.json();
                    showError('login', '');
                    enterChat();
                } else {
                    const error = await response.json();
                    showError('login', error.error || 'Invalid credentials');
                }
            } catch (e) {
                console.error(e);
                showError('login', 'Server connection failed');
            }
        });

        // Signup
        document.getElementById('signup-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('signup-username').value.trim();
            const email = document.getElementById('signup-email').value.trim();
            const firstName = document.getElementById('signup-firstname').value.trim();
            const lastName = document.getElementById('signup-lastname').value.trim();
            const password = document.getElementById('signup-password').value;

            try {
                const response = await fetch(`${API_URL}/signup`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, email, firstName, lastName, secret: password })
                });

                if (response.ok) {
                    currentUser = await response.json();
                    showError('signup', '');
                    enterChat();
                } else {
                    const error = await response.json();
                    showError('signup', error.error || 'Signup failed');
                }
            } catch (e) {
                console.error(e);
                showError('signup', 'Server connection failed');
            }
        });

        function showError(type, message) {
            const errorDiv = document.getElementById(`${type}-error`);
            if (message) {
                errorDiv.textContent = message;
                errorDiv.classList.remove('hidden');
            } else {
                errorDiv.classList.add('hidden');
            }
        }

        // Admin Reset Functions
        function showAdminReset() {
            document.getElementById('admin-modal').style.display = 'flex';
        }

        function hideAdminReset() {
            document.getElementById('admin-modal').style.display = 'none';
            document.getElementById('admin-secret').value = '';
            document.getElementById('admin-error').style.display = 'none';
        }

        async function executeAdminReset() {
            const secret = document.getElementById('admin-secret').value;
            const errorDiv = document.getElementById('admin-error');

            if (!secret) {
                errorDiv.textContent = 'Please enter the secret code';
                errorDiv.style.display = 'block';
                return;
            }

            try {
                const response = await fetch(`${API_URL}/admin/reset`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ secret: secret })
                });

                if (response.ok) {
                    const data = await response.json();
                    alert(`âœ… Success! Deleted ${data.usersDeleted} users and ${data.messagesDeleted} messages.`);
                    hideAdminReset();
                    location.reload();
                } else {
                    const error = await response.json();
                    errorDiv.textContent = error.error || 'Reset failed';
                    errorDiv.style.display = 'block';
                }
            } catch (e) {
                console.error(e);
                errorDiv.textContent = 'Connection failed';
                errorDiv.style.display = 'block';
            }
        }

        function enterChat() {
            document.getElementById('auth-page').style.display = 'none';
            document.getElementById('chat-app').classList.add('active');
            document.getElementById('current-username').textContent = currentUser.username;

            // Connect to WebSocket
            const socket = new SockJS(`${API_URL}/ws?username=${currentUser.username}`);
            stompClient = Stomp.over(socket);
            stompClient.connect({}, onConnected, onError);
        }

        function onConnected() {
            console.log('âœ… Connected to WebSocket');
            stompClient.subscribe('/user/queue/private', onMessageReceived);
            // Load users and pending requests
            loadUsers();
            loadPendingRequests();
        }

        function onError(error) {
            console.error('WebSocket error:', error);
            alert('Could not connect to chat server');
        }

        function onMessageReceived(payload) {
            const message = JSON.parse(payload.body);
            const otherUser = message.sender === currentUser.username ? message.recipient : message.sender;

            if (selectedRecipient === otherUser) {
                displayMessage(message);
            }
        }

        // Friend Request Functions
        function toggleFriendRequests() {
            const panel = document.getElementById('requests-panel');
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        }

        async function loadPendingRequests() {
            try {
                const response = await fetch(`${API_URL}/friends/requests/pending?username=${currentUser.username}`);
                if (response.ok) {
                    const requests = await response.json();
                    const badge = document.getElementById('request-badge');
                    const list = document.getElementById('pending-requests-list');

                    if (requests.length > 0) {
                        badge.textContent = requests.length;
                        badge.style.display = 'flex';

                        list.innerHTML = requests.map(req => `
                            <div style="background: white; padding: 8px; border-radius: 6px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                                <span style="font-weight: 600; font-size: 13px;">${req.sender}</span>
                                <div style="display: flex; gap: 5px;">
                                    <button onclick="acceptRequest(${req.id})" style="background: #4ade80; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;">Accept</button>
                                    <button onclick="rejectRequest(${req.id})" style="background: #ef4444; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;">Reject</button>
                                </div>
                            </div>
                        `).join('');
                    } else {
                        badge.style.display = 'none';
                        list.innerHTML = '<div style="color: #999; font-size: 12px; text-align: center;">No pending requests</div>';
                    }
                }
            } catch (e) {
                console.error("Error loading requests:", e);
            }
        }

        async function sendFriendRequest(receiver) {
            try {
                const response = await fetch(`${API_URL}/friends/request`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sender: currentUser.username, receiver: receiver })
                });

                if (response.ok) {
                    alert(`âœ… Friend request sent to ${receiver}!`);
                    loadUsers(); // Refresh to update status
                } else {
                    const error = await response.json();
                    alert(`âŒ ${error.error || 'Failed to send request'}`);
                }
            } catch (e) {
                console.error(e);
                alert('Connection error');
            }
        }

        async function acceptRequest(id) {
            try {
                await fetch(`${API_URL}/friends/accept/${id}`, { method: 'POST' });
                loadPendingRequests();
                loadUsers();
                loadFriendsList();
            } catch (e) {
                console.error(e);
            }
        }

        async function rejectRequest(id) {
            try {
                await fetch(`${API_URL}/friends/reject/${id}`, { method: 'POST' });
                loadPendingRequests();
            } catch (e) {
                console.error(e);
            }
        }

        let friendsList = [];
        async function loadFriendsList() {
            try {
                const response = await fetch(`${API_URL}/friends/list?username=${currentUser.username}`);
                if (response.ok) {
                    friendsList = await response.json();
                }
            } catch (e) {
                console.error(e);
            }
        }

        async function loadUsers() {
            try {
                // Also get friends list to check status first
                await loadFriendsList();

                const response = await fetch(`${API_URL}/users/search?username=`);
                const users = await response.json();

                allUsers = users.filter(u => u.username !== currentUser.username);
                displayUsers(allUsers);
            } catch (e) {
                console.error('Load users error:', e);
                document.getElementById('users-list').innerHTML = '<div class="empty-state">Error loading users</div>';
            }
        }

        function displayUsers(users) {
            const usersList = document.getElementById('users-list');

            if (users.length === 0) {
                usersList.innerHTML = '<div class="empty-state">No users found</div>';
                return;
            }

            usersList.innerHTML = '';
            users.forEach(user => {
                const isFriend = friendsList.includes(user.username);
                let statusHtml = '';

                if (isFriend) {
                    statusHtml = '<span style="color: #4ade80; font-size: 12px; font-weight: 600;">Friend âœ…</span>';
                } else {
                    // Start of render_diff logic adaptation: 
                    // Add friend button that stops propagation so we don't select the user
                    statusHtml = `<button onclick="sendFriendRequest('${user.username}'); event.stopPropagation();" style="background: #3b82f6; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;">Add Friend</button>`;
                }

                const userItem = document.createElement('div');
                userItem.className = 'user-item';
                userItem.id = `user-${user.username}`;
                userItem.onclick = () => selectUser(user.username);

                userItem.innerHTML = `
                    <div class="user-avatar">${user.username[0].toUpperCase()}</div>
                    <div class="user-info">
                        <div class="user-name">${user.username}</div>
                        <div class="status-row" style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
                            <div class="user-status">Online</div>
                            <div>${statusHtml}</div>
                        </div>
                    </div>
                `;
                usersList.appendChild(userItem);
            });
        }

        function filterUsers(query) {
            if (!query) {
                displayUsers(allUsers);
                return;
            }

            const filtered = allUsers.filter(user =>
                user.username.toLowerCase().includes(query.toLowerCase())
            );
            displayUsers(filtered);
        }

        async function selectUser(username) {
            selectedRecipient = username;

            // Update header
            document.getElementById('chat-name').textContent = username;
            document.getElementById('chat-status').textContent = 'Online';
            document.getElementById('chat-avatar').textContent = username[0].toUpperCase();

            // Check if friend to enable/disable input
            const isFriend = friendsList.includes(username);
            const input = document.getElementById('message-input');
            const btn = document.getElementById('send-btn');

            if (isFriend) {
                input.disabled = false;
                input.placeholder = "Type a message...";
                btn.disabled = false;
                btn.style.opacity = "1";
                btn.style.cursor = "pointer";
            } else {
                input.disabled = true;
                input.placeholder = "Accepted friend request required to chat";
                btn.disabled = true;
                btn.style.opacity = "0.5";
                btn.style.cursor = "not-allowed";
            }

            // Clear messages
            document.getElementById('messages').innerHTML = '';

            // Highlight selected user
            document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));
            const userEl = document.getElementById(`user-${username}`);
            if (userEl) userEl.classList.add('active');

            // Load chat history
            loadChatHistory(username);
        }

        async function loadChatHistory(contact) {
            try {
                const response = await fetch(`${API_URL}/messages/${contact}?currentUser=${currentUser.username}`);
                if (response.ok) {
                    const messages = await response.json();
                    console.log(`Loaded ${messages.length} messages`);
                    messages.forEach(displayMessage);
                }
            } catch (e) {
                console.error('Error loading history:', e);
            }
        }

        // Send message
        document.getElementById('message-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const messageContent = document.getElementById('message-input').value.trim();

            if (messageContent && stompClient && selectedRecipient) {
                const chatMessage = {
                    sender: currentUser.username,
                    recipient: selectedRecipient,
                    content: messageContent,
                    type: 'CHAT',
                    timestamp: Date.now()
                };

                stompClient.send("/app/chat.private", {}, JSON.stringify(chatMessage));
                document.getElementById('message-input').value = '';
            }
        });

        function displayMessage(message) {
            const messagesDiv = document.getElementById('messages');

            const messageDiv = document.createElement('div');
            messageDiv.className = 'message';
            if (message.sender === currentUser.username) {
                messageDiv.classList.add('own');
            }

            const time = new Date(message.timestamp).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit'
            });

            messageDiv.innerHTML = `
                <div class="message-content">
                    <div class="message-sender">${message.sender}</div>
                    ${escapeHtml(message.content)}
                    <div class="message-time">${time}</div>
                </div>
            `;

            messagesDiv.appendChild(messageDiv);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function logout() {
            // Disconnect WebSocket
            if (stompClient) {
                stompClient.disconnect();
            }
            currentUser = null;
            document.getElementById('chat-app').classList.remove('active');
            document.getElementById('auth-page').style.display = 'block';
            document.getElementById('login-form').reset();

            // Clear location reload to prevent re-login
            window.location.reload();
        }
    </script>
</body>

</html>

`


## File: server-spring\pom.xml
`$lang

<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
	xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
	<modelVersion>4.0.0</modelVersion>
	<parent>
		<groupId>org.springframework.boot</groupId>
		<artifactId>spring-boot-starter-parent</artifactId>
		<version>3.5.10</version>
		<relativePath/>
		<!-- lookup parent from repository -->
	</parent>
	<groupId>com.example.chatengine</groupId>
	<artifactId>server-spring</artifactId>
	<version>0.0.1-SNAPSHOT</version>
	<name>server-spring</name>
	<description>Demo chat project for Spring Boot</description>
	<properties>
		<java.version>21</java.version>
	</properties>
	<dependencies>
		<dependency>
			<groupId>org.springframework.boot</groupId>
			<artifactId>spring-boot-starter-web</artifactId>
		</dependency>

		<dependency>
			<groupId>org.springframework.boot</groupId>
			<artifactId>spring-boot-starter-test</artifactId>
			<scope>test</scope>
		</dependency>

		<dependency>
			<groupId>org.springframework.boot</groupId>
			<artifactId>spring-boot-starter-websocket</artifactId>
		</dependency>

		<dependency>
			<groupId>org.springframework.boot</groupId>
			<artifactId>spring-boot-starter-data-jpa</artifactId>
		</dependency>

		<dependency>
			<groupId>com.h2database</groupId>
			<artifactId>h2</artifactId>
			<scope>runtime</scope>
		</dependency>

		<dependency>
			<groupId>org.postgresql</groupId>
			<artifactId>postgresql</artifactId>
			<scope>runtime</scope>
		</dependency>

		<!-- Spring Security -->
		<dependency>
			<groupId>org.springframework.boot</groupId>
			<artifactId>spring-boot-starter-security</artifactId>
		</dependency>

		<!-- JWT -->
		<dependency>
			<groupId>io.jsonwebtoken</groupId>
			<artifactId>jjwt-api</artifactId>
			<version>0.12.3</version>
		</dependency>
		<dependency>
			<groupId>io.jsonwebtoken</groupId>
			<artifactId>jjwt-impl</artifactId>
			<version>0.12.3</version>
			<scope>runtime</scope>
		</dependency>
		<dependency>
			<groupId>io.jsonwebtoken</groupId>
			<artifactId>jjwt-jackson</artifactId>
			<version>0.12.3</version>
			<scope>runtime</scope>
		</dependency>

		<!-- Validation -->
		<dependency>
			<groupId>org.springframework.boot</groupId>
			<artifactId>spring-boot-starter-validation</artifactId>
		</dependency>

		<!-- Rate Limiting -->
		<dependency>
			<groupId>com.bucket4j</groupId>
			<artifactId>bucket4j-core</artifactId>
			<version>8.7.0</version>
		</dependency>

		<!-- HTML Sanitization -->
		<dependency>
			<groupId>org.owasp.encoder</groupId>
			<artifactId>encoder</artifactId>
			<version>1.2.3</version>
		</dependency>

	</dependencies>

	<build>
		<plugins>
			<plugin>
				<groupId>org.springframework.boot</groupId>
				<artifactId>spring-boot-maven-plugin</artifactId>
			</plugin>
		</plugins>
	</build>

</project>

`


## File: netlify.toml
`$lang

[build]
  publish = "public"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

`


## File: render.yaml
`$lang

services:
  - type: web
    name: boxbi-backend
    env: docker
    dockerfilePath: server-spring/Dockerfile
    envVars:
      - key: DB_HOST
        fromDatabase:
          name: boxbi-db
          property: host
      - key: DB_PORT
        fromDatabase:
          name: boxbi-db
          property: port
      - key: DB_NAME
        fromDatabase:
          name: boxbi-db
          property: database
      - key: SPRING_DATASOURCE_USERNAME
        fromDatabase:
          name: boxbi-db
          property: user
      - key: SPRING_DATASOURCE_PASSWORD
        fromDatabase:
          name: boxbi-db
          property: password
      - key: SPRING_DATASOURCE_DRIVER_CLASS_NAME
        value: org.postgresql.Driver
      - key: SPRING_JPA_DATABASE_PLATFORM
        value: org.hibernate.dialect.PostgreSQLDialect
    plan: free

databases:
  - name: boxbi-db
    databaseName: boxbi
    user: boxbi_user
    plan: free

`

