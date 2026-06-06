package com.example.chatengine.serverspring;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

// CORS is configured globally in SecurityConfig — no @CrossOrigin annotations needed here.
@RestController
@RequestMapping("/groups")
public class GroupController {

    private static final Logger log = LoggerFactory.getLogger(GroupController.class);
    private static final String KEY_ERROR = "error";
    private static final String KEY_MESSAGE = "message";

    private final GroupRepository groupRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final MessageRepository messageRepository;

    public GroupController(GroupRepository groupRepository,
                           GroupMemberRepository groupMemberRepository,
                           MessageRepository messageRepository) {
        this.groupRepository = groupRepository;
        this.groupMemberRepository = groupMemberRepository;
        this.messageRepository = messageRepository;
    }

    @PostMapping("/create")
    public ResponseEntity<Object> createGroup(@RequestBody Map<String, Object> payload,
                                              java.security.Principal principal) {
        try {
            String name = (String) payload.get("name");
            // Creator is always the authenticated user — never trusted from the body.
            String createdBy = principal.getName();
            @SuppressWarnings("unchecked")
            List<String> members = (List<String>) payload.get("members");

            if (name == null || name.trim().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of(KEY_ERROR, "Group name is required"));
            }

            ChatGroup group = new ChatGroup(name, createdBy);
            group = groupRepository.save(group);
            log.info("Group created with ID: {}", group.getId());

            groupMemberRepository.save(new GroupMember(group, createdBy));

            if (members != null) {
                for (String member : members) {
                    if (member != null && !member.isEmpty() && !member.equals(createdBy)) {
                        groupMemberRepository.save(new GroupMember(group, member));
                    }
                }
            }
            return ResponseEntity.ok(group);
        } catch (Exception e) {
            log.error("Failed to create group: {}", e.getMessage(), e);
            return ResponseEntity.status(500).body(Map.of(KEY_ERROR, "Failed to create group"));
        }
    }

    @GetMapping("/user/{username}")
    public ResponseEntity<List<ChatGroup>> getUserGroups(@PathVariable String username,
                                                         java.security.Principal principal) {
        // A user may only list their own groups.
        if (!principal.getName().equals(username)) {
            return ResponseEntity.status(403).build();
        }
        List<GroupMember> memberships = groupMemberRepository.findByUsername(username);
        List<ChatGroup> groups = memberships.stream()
                .map(GroupMember::getGroup)
                .toList();
        return ResponseEntity.ok(groups);
    }

    @GetMapping("/{groupId}/messages")
    public ResponseEntity<List<ChatMessage>> getGroupMessages(@PathVariable Long groupId,
                                                              java.security.Principal principal) {
        // Only group members may read group history.
        Optional<ChatGroup> groupOpt = groupRepository.findById(groupId);
        if (groupOpt.isEmpty()
                || !groupMemberRepository.existsByGroupAndUsername(groupOpt.orElseThrow(), principal.getName())) {
            return ResponseEntity.status(403).build();
        }
        List<ChatMessage> messages = messageRepository.findByGroupIdOrderByTimestamp(groupId);
        return ResponseEntity.ok(messages);
    }

    @PostMapping("/{groupId}/leave")
    public ResponseEntity<Object> leaveGroup(@PathVariable Long groupId, java.security.Principal principal) {
        try {
            String username = principal.getName();
            Optional<ChatGroup> groupOpt = groupRepository.findById(groupId);
            if (groupOpt.isEmpty()) {
                return ResponseEntity.status(404).body(Map.of(KEY_ERROR, "Group not found"));
            }

            ChatGroup group = groupOpt.orElseThrow();
            Optional<GroupMember> memberOpt = groupMemberRepository.findByUsername(username).stream()
                    .filter(m -> m.getGroup().getId().equals(groupId))
                    .findFirst();

            if (memberOpt.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of(KEY_ERROR, "You are not a member of this group"));
            }

            groupMemberRepository.delete(memberOpt.orElseThrow());

            List<GroupMember> remaining = groupMemberRepository.findByGroup(group);
            if (remaining.isEmpty()) {
                messageRepository.deleteByGroupId(groupId);
                groupRepository.delete(group);
            }

            return ResponseEntity.ok(Map.of(KEY_MESSAGE, "Left group successfully"));
        } catch (Exception e) {
            log.error("Failed to leave group {}: {}", groupId, e.getMessage(), e);
            return ResponseEntity.status(500).body(Map.of(KEY_ERROR, "Failed to leave group"));
        }
    }
}
