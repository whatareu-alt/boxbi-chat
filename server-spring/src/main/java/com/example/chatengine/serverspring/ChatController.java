package com.example.chatengine.serverspring;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.owasp.encoder.Encode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.http.ResponseEntity;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

// CORS is configured globally in SecurityConfig — no @CrossOrigin annotations needed here.
@RestController
public class ChatController {

    private static final Logger log = LoggerFactory.getLogger(ChatController.class);

    private static final String PRIVATE_QUEUE = "/queue/private";
    private static final String ERR_MSG_NOT_FOUND = "Message not found";
    private static final String ERR_FORBIDDEN = "Forbidden";
    private static final String KEY_ERROR = "error";
    private static final String KEY_MESSAGE = "message";
    private static final String KEY_RECIPIENT = "recipient";
    private static final String KEY_GROUP_ID = "groupId";
    private static final String KEY_TIMESTAMP = "timestamp";
    private static final String KEY_EMOJI = "emoji";
    private static final String ANONYMOUS = "Anonymous";

    private final SimpMessagingTemplate messagingTemplate;
    private final MessageRepository messageRepository;
    private final FriendRequestRepository friendRequestRepository;
    private final MessageReactionRepository messageReactionRepository;
    private final BlockedUserRepository blockedUserRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final GroupRepository groupRepository;

    public ChatController(SimpMessagingTemplate messagingTemplate,
                          MessageRepository messageRepository,
                          FriendRequestRepository friendRequestRepository,
                          MessageReactionRepository messageReactionRepository,
                          BlockedUserRepository blockedUserRepository,
                          GroupMemberRepository groupMemberRepository,
                          GroupRepository groupRepository) {
        this.messagingTemplate = messagingTemplate;
        this.messageRepository = messageRepository;
        this.friendRequestRepository = friendRequestRepository;
        this.messageReactionRepository = messageReactionRepository;
        this.blockedUserRepository = blockedUserRepository;
        this.groupMemberRepository = groupMemberRepository;
        this.groupRepository = groupRepository;
    }

    @MessageMapping("/chat.sendMessage")
    @SendTo("/topic/public")
    public ChatMessage sendMessage(@Valid @Payload @NotNull ChatMessage chatMessage,
            java.security.Principal principal) {
        // Sender identity comes from the authenticated WebSocket principal, not the payload.
        chatMessage.setSender(principal != null ? principal.getName() : ANONYMOUS);
        if (chatMessage.getContent() != null) {
            chatMessage.setContent(Encode.forHtml(chatMessage.getContent()));
        }
        chatMessage.setTimestamp(System.currentTimeMillis());
        return chatMessage;
    }

    @MessageMapping("/chat.private")
    public void sendPrivateMessage(@Valid @Payload @NotNull ChatMessage chatMessage,
            java.security.Principal principal) {
        if (principal == null) {
            log.warn("⚠️ Private message BLOCKED: unauthenticated WebSocket session");
            return;
        }
        // Trust the authenticated principal for the sender — never the client payload.
        chatMessage.setSender(principal.getName());
        log.info("📨 PRIVATE MESSAGE — From: {} To: {}", chatMessage.getSender(), chatMessage.getRecipient());

        boolean areFriends = friendRequestRepository.areFriends(
                chatMessage.getSender(),
                chatMessage.getRecipient());

        if (!areFriends) {
            log.warn("⚠️ Message BLOCKED: Users are not friends");
            return;
        }

        if (blockedUserRepository.existsByBlockerAndBlocked(chatMessage.getRecipient(), chatMessage.getSender())) {
            log.warn("⚠️ Message BLOCKED: Sender is blocked by recipient");
            return;
        }

        if (chatMessage.getContent() != null) {
            chatMessage.setContent(Objects.requireNonNullElse(Encode.forHtml(chatMessage.getContent()), ""));
        }
        chatMessage.setTimestamp(System.currentTimeMillis());

        try {
            messageRepository.save(chatMessage);
            log.debug("💾 Message saved to database");
        } catch (Exception e) {
            log.error("❌ Error saving message to database: {}", e.getMessage(), e);
        }

        if (chatMessage.getRecipient() != null) {
            try {
                messagingTemplate.convertAndSendToUser(
                        Objects.requireNonNull(chatMessage.getRecipient()),
                        PRIVATE_QUEUE,
                        chatMessage);
                log.debug("✅ Sent to recipient: {}", chatMessage.getRecipient());
            } catch (Exception e) {
                log.error("❌ Error sending to recipient: {}", e.getMessage(), e);
            }

            if (chatMessage.getSender() != null) {
                try {
                    messagingTemplate.convertAndSendToUser(
                            Objects.requireNonNull(chatMessage.getSender()),
                            PRIVATE_QUEUE,
                            chatMessage);
                    log.debug("✅ Sent back to sender: {}", chatMessage.getSender());
                } catch (Exception e) {
                    log.error("❌ Error sending to sender: {}", e.getMessage(), e);
                }
            }
        }
    }

    @MessageMapping("/chat.group")
    public void sendGroupMessage(@Valid @Payload @NotNull ChatMessage chatMessage,
            java.security.Principal principal) {
        if (principal == null) {
            log.warn("⚠️ Group message BLOCKED: unauthenticated WebSocket session");
            return;
        }
        if (chatMessage.getGroupId() == null) {
            log.error("❌ Group ID is missing");
            return;
        }

        // Trust the authenticated principal for the sender, and require group membership.
        chatMessage.setSender(principal.getName());
        log.info("👥 GROUP MESSAGE — GroupId: {} From: {}", chatMessage.getGroupId(), chatMessage.getSender());

        Optional<ChatGroup> groupOpt = groupRepository.findById(chatMessage.getGroupId());
        if (groupOpt.isEmpty()
                || !groupMemberRepository.existsByGroupAndUsername(groupOpt.orElseThrow(), chatMessage.getSender())) {
            log.warn("⚠️ Group message BLOCKED: {} is not a member of group {}",
                    chatMessage.getSender(), chatMessage.getGroupId());
            return;
        }

        if (chatMessage.getContent() != null) {
            chatMessage.setContent(Encode.forHtml(chatMessage.getContent()));
        }
        chatMessage.setTimestamp(System.currentTimeMillis());

        try {
            messageRepository.save(chatMessage);
            log.debug("💾 Group message saved");
        } catch (Exception e) {
            log.error("❌ Error saving group message: {}", e.getMessage(), e);
        }

        String destination = "/topic/group." + chatMessage.getGroupId();
        messagingTemplate.convertAndSend(destination, (Object) chatMessage);
        log.debug("📢 Sent to topic: {}", destination);
    }

    @MessageMapping("/chat.addUser")
    @SendTo("/topic/public")
    public ChatMessage addUser(@Valid @Payload @NotNull ChatMessage chatMessage,
            @NotNull SimpMessageHeaderAccessor headerAccessor,
            java.security.Principal principal) {
        String sanitizedUsername = principal != null ? principal.getName() : ANONYMOUS;
        chatMessage.setSender(sanitizedUsername);

        var sessionAttributes = headerAccessor.getSessionAttributes();
        if (sessionAttributes != null) {
            sessionAttributes.put("username", sanitizedUsername);
        }
        chatMessage.setType("JOIN");
        chatMessage.setTimestamp(System.currentTimeMillis());
        return chatMessage;
    }

    @GetMapping("/messages/{contact}")
    public ResponseEntity<List<ChatMessage>> getChatHistory(
            @PathVariable String contact,
            java.security.Principal principal) {
        try {
            // Identity comes from the authenticated principal, never from a client-supplied param.
            String currentUser = principal.getName();
            List<ChatMessage> messages = messageRepository.findConversationBetween(currentUser, contact);
            return ResponseEntity.ok(messages);
        } catch (Exception e) {
            log.error("❌ Error fetching chat history: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @DeleteMapping("/messages/{contact}")
    public ResponseEntity<Void> deleteChatHistory(
            @PathVariable String contact,
            java.security.Principal principal) {
        try {
            String currentUser = principal.getName();
            messageRepository.deleteConversationBetween(currentUser, contact);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            log.error("❌ Error deleting chat history: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().build();
        }
    }

    private void broadcastEvent(Map<String, Object> event, String sender, String recipient, Long groupId) {
        if (groupId != null) {
            messagingTemplate.convertAndSend("/topic/group." + groupId, (Object) event);
        } else if (recipient != null) {
            messagingTemplate.convertAndSendToUser(recipient, PRIVATE_QUEUE, (Object) event);
            if (sender != null) {
                messagingTemplate.convertAndSendToUser(sender, PRIVATE_QUEUE, (Object) event);
            }
        }
    }

    @PutMapping("/messages/msg/{id}")
    public ResponseEntity<Object> editMessage(
            @PathVariable Long id,
            @RequestBody Map<String, String> payload,
            java.security.Principal principal) {
        try {
            String currentUser = principal.getName();
            String content = payload.get("content");
            if (content == null || content.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of(KEY_ERROR, "Content is required"));
            }

            Optional<ChatMessage> msgOpt = messageRepository.findById(id);
            if (msgOpt.isEmpty()) {
                return ResponseEntity.status(404).body(Map.of(KEY_ERROR, ERR_MSG_NOT_FOUND));
            }

            ChatMessage msg = msgOpt.orElseThrow();
            if (!msg.getSender().equals(currentUser)) {
                return ResponseEntity.status(403).body(Map.of(KEY_ERROR, ERR_FORBIDDEN));
            }
            if (msg.getIsDeleted()) {
                return ResponseEntity.badRequest().body(Map.of(KEY_ERROR, "Cannot edit a deleted message"));
            }

            msg.setContent(Encode.forHtml(content.trim()));
            msg.setIsEdited(true);
            msg.setEditedAt(System.currentTimeMillis());
            messageRepository.save(msg);

            Map<String, Object> event = new HashMap<>();
            event.put("type", "MESSAGE_EDITED");
            event.put("id", id);
            event.put("content", msg.getContent());
            event.put("sender", msg.getSender());
            event.put(KEY_RECIPIENT, msg.getRecipient());
            event.put(KEY_GROUP_ID, msg.getGroupId());
            event.put(KEY_TIMESTAMP, System.currentTimeMillis());

            broadcastEvent(event, msg.getSender(), msg.getRecipient(), msg.getGroupId());
            return ResponseEntity.ok(Map.of(KEY_MESSAGE, "Message edited successfully"));
        } catch (Exception e) {
            log.error("❌ Error editing message {}: {}", id, e.getMessage(), e);
            return ResponseEntity.status(500).body(Map.of(KEY_ERROR, "Failed to edit message"));
        }
    }

    @DeleteMapping("/messages/msg/{id}")
    public ResponseEntity<Object> deleteMessage(
            @PathVariable Long id,
            java.security.Principal principal) {
        try {
            String currentUser = principal.getName();
            Optional<ChatMessage> msgOpt = messageRepository.findById(id);
            if (msgOpt.isEmpty()) {
                return ResponseEntity.status(404).body(Map.of(KEY_ERROR, ERR_MSG_NOT_FOUND));
            }

            ChatMessage msg = msgOpt.orElseThrow();
            if (!msg.getSender().equals(currentUser)) {
                return ResponseEntity.status(403).body(Map.of(KEY_ERROR, ERR_FORBIDDEN));
            }

            msg.setIsDeleted(true);
            msg.setContent("This message was deleted");
            messageRepository.save(msg);

            Map<String, Object> event = new HashMap<>();
            event.put("type", "MESSAGE_DELETED");
            event.put("id", id);
            event.put("sender", msg.getSender());
            event.put(KEY_RECIPIENT, msg.getRecipient());
            event.put(KEY_GROUP_ID, msg.getGroupId());
            event.put(KEY_TIMESTAMP, System.currentTimeMillis());

            broadcastEvent(event, msg.getSender(), msg.getRecipient(), msg.getGroupId());
            return ResponseEntity.ok(Map.of(KEY_MESSAGE, "Message deleted successfully"));
        } catch (Exception e) {
            log.error("❌ Error deleting message {}: {}", id, e.getMessage(), e);
            return ResponseEntity.status(500).body(Map.of(KEY_ERROR, "Failed to delete message"));
        }
    }

    @PostMapping("/messages/msg/{id}/react")
    public ResponseEntity<Object> reactToMessage(
            @PathVariable Long id,
            @RequestBody Map<String, String> payload,
            java.security.Principal principal) {
        try {
            String currentUser = principal.getName();
            String emoji = payload.get(KEY_EMOJI);
            if (emoji == null || emoji.trim().isEmpty() || emoji.length() > 8) {
                return ResponseEntity.badRequest().body(Map.of(KEY_ERROR, "Valid emoji required (max 8 chars)"));
            }

            Optional<ChatMessage> msgOpt = messageRepository.findById(id);
            if (msgOpt.isEmpty()) {
                return ResponseEntity.status(404).body(Map.of(KEY_ERROR, ERR_MSG_NOT_FOUND));
            }

            ChatMessage msg = msgOpt.orElseThrow();
            if (msg.getIsDeleted()) {
                return ResponseEntity.badRequest().body(Map.of(KEY_ERROR, "Cannot react to a deleted message"));
            }

            if (!hasMessageAccess(msg, currentUser)) {
                return ResponseEntity.status(403).body(Map.of(KEY_ERROR, ERR_FORBIDDEN));
            }

            Optional<MessageReaction> existing = messageReactionRepository
                    .findByMessageIdAndUsernameAndEmoji(id, currentUser, emoji);
            String eventType;
            if (existing.isPresent()) {
                messageReactionRepository.delete(existing.orElseThrow());
                eventType = "REACTION_REMOVED";
            } else {
                messageReactionRepository.save(new MessageReaction(id, currentUser, emoji));
                eventType = "REACTION_ADDED";
            }

            Map<String, Object> event = new HashMap<>();
            event.put("type", eventType);
            event.put("messageId", id);
            event.put("username", currentUser);
            event.put(KEY_EMOJI, emoji);
            event.put(KEY_RECIPIENT, msg.getRecipient());
            event.put(KEY_GROUP_ID, msg.getGroupId());
            event.put(KEY_TIMESTAMP, System.currentTimeMillis());

            broadcastEvent(event, msg.getSender(), msg.getRecipient(), msg.getGroupId());
            return ResponseEntity.ok(Map.of(
                    KEY_MESSAGE, existing.isPresent() ? "Reaction removed" : "Reaction added",
                    "action", eventType));
        } catch (Exception e) {
            log.error("❌ Error reacting to message {}: {}", id, e.getMessage(), e);
            return ResponseEntity.status(500).body(Map.of(KEY_ERROR, "Failed to react to message"));
        }
    }

    /** True if the user is a participant of the message (sender, recipient, or group member). */
    private boolean hasMessageAccess(ChatMessage msg, String currentUser) {
        if (msg.getSender().equals(currentUser)
                || (msg.getRecipient() != null && msg.getRecipient().equals(currentUser))) {
            return true;
        }
        if (msg.getGroupId() != null) {
            Optional<ChatGroup> groupOpt = groupRepository.findById(msg.getGroupId());
            return groupOpt.isPresent()
                    && groupMemberRepository.existsByGroupAndUsername(groupOpt.orElseThrow(), currentUser);
        }
        return false;
    }

    @SuppressWarnings("unchecked")
    @GetMapping("/messages/msg/{id}/reactions")
    public ResponseEntity<Object> getMessageReactions(@PathVariable Long id, java.security.Principal principal) {
        try {
            Optional<ChatMessage> msgOpt = messageRepository.findById(id);
            if (msgOpt.isEmpty()) {
                return ResponseEntity.status(404).body(Map.of(KEY_ERROR, ERR_MSG_NOT_FOUND));
            }
            if (!hasMessageAccess(msgOpt.orElseThrow(), principal.getName())) {
                return ResponseEntity.status(403).body(Map.of(KEY_ERROR, ERR_FORBIDDEN));
            }

            List<MessageReaction> reactions = messageReactionRepository.findByMessageId(id);
            Map<String, Map<String, Object>> aggregates = new HashMap<>();
            for (MessageReaction reaction : reactions) {
                String emoji = reaction.getEmoji();
                Map<String, Object> data = aggregates.getOrDefault(emoji, new HashMap<>());
                int count = (int) data.getOrDefault("count", 0) + 1;
                List<String> usersList = (List<String>) data.getOrDefault("usersList", new ArrayList<String>());
                usersList.add(reaction.getUsername());

                data.put(KEY_EMOJI, emoji);
                data.put("count", count);
                data.put("usersList", usersList);
                data.put("users", String.join(",", usersList));
                aggregates.put(emoji, data);
            }
            return ResponseEntity.ok(new ArrayList<>(aggregates.values()));
        } catch (Exception e) {
            log.error("❌ Error fetching reactions for message {}: {}", id, e.getMessage(), e);
            return ResponseEntity.status(500).body(Map.of(KEY_ERROR, "Failed to get reactions"));
        }
    }

    @GetMapping("/messages/search")
    public ResponseEntity<Object> searchMessages(
            @RequestParam String q,
            @RequestParam(defaultValue = "20") int limit,
            java.security.Principal principal) {
        try {
            String currentUser = principal.getName();
            if (q.trim().length() < 2) {
                return ResponseEntity.ok(List.of());
            }
            // Escape LIKE wildcards so user input is treated literally (ESCAPE '\' in the query).
            String escaped = q.trim()
                    .replace("\\", "\\\\")
                    .replace("%", "\\%")
                    .replace("_", "\\_");
            String query = "%" + escaped + "%";
            List<ChatMessage> results = messageRepository.searchMessages(query, currentUser);
            if (results.size() > limit) {
                results = results.subList(0, limit);
            }
            return ResponseEntity.ok(results);
        } catch (Exception e) {
            log.error("❌ Error searching messages: {}", e.getMessage(), e);
            return ResponseEntity.status(500).body(Map.of(KEY_ERROR, "Failed to search messages"));
        }
    }
}
