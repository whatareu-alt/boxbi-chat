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
        "https://chatappboxbi.netlify.app",
        "https://zoobichatapp.netlify.app",
        "https://boxbi.online",
        "https://www.boxbi.online",
        "https://boxmsg.netlify.app",
        "https://boxbichat.netlify.app",
        "http://localhost:*",
        "http://127.0.0.1:*",
        "http://localhost:5500",
        "https://*.netlify.app"
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
        String name = (String) payload.get("name");
        String createdBy = (String) payload.get("createdBy");
        @SuppressWarnings("unchecked")
        List<String> members = (List<String>) payload.get("members");

        if (name == null || createdBy == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Name and createdBy are required"));
        }

        ChatGroup group = new ChatGroup(name, createdBy);
        group = groupRepository.save(group);

        // Add creator as member
        groupMemberRepository.save(new GroupMember(group, createdBy));

        // Add other members
        if (members != null) {
            for (String member : members) {
                if (!member.equals(createdBy)) {
                    groupMemberRepository.save(new GroupMember(group, member));
                }
            }
        }
        return ResponseEntity.ok(group);
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
