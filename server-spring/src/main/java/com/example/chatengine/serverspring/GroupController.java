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
        "http://127.0.0.1:*"
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
