package com.example.chatengine.serverspring.controller;

import com.example.chatengine.serverspring.User;
import com.example.chatengine.serverspring.UserRepository;
import com.example.chatengine.serverspring.model.FriendRequest;
import com.example.chatengine.serverspring.repository.FriendRequestRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/friends")
@CrossOrigin(origins = "*") // Allow all for now
public class FriendController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private FriendRequestRepository friendRequestRepository;

    @PostMapping("/add")
    public ResponseEntity<?> sendFriendRequest(@RequestBody Map<String, String> payload) {
        String senderUsername = payload.get("sender");
        String receiverUsername = payload.get("receiver");

        User sender = userRepository.findByUsername(senderUsername)
                .orElseThrow(() -> new RuntimeException("Sender not found"));
        User receiver = userRepository.findByUsername(receiverUsername)
                .orElseThrow(() -> new RuntimeException("Receiver not found"));

        if (sender.equals(receiver)) {
            return ResponseEntity.badRequest().body("Cannot add yourself");
        }

        Optional<FriendRequest> existing = friendRequestRepository.findExistingRequest(sender, receiver);
        if (existing.isPresent()) {
            return ResponseEntity.badRequest().body("Request already exists or are already friends");
        }

        FriendRequest request = new FriendRequest(sender, receiver);
        friendRequestRepository.save(request);

        return ResponseEntity.ok("Friend request sent");
    }

    @PostMapping("/accept")
    public ResponseEntity<?> acceptFriendRequest(@RequestBody Map<String, Long> payload) {
        Long requestId = payload.get("requestId");
        if (requestId == null) {
            return ResponseEntity.badRequest().body("Request ID is required");
        }
        FriendRequest request = friendRequestRepository.findById(requestId)
                .orElseThrow(() -> new RuntimeException("Request not found"));

        request.setStatus("ACCEPTED");
        friendRequestRepository.save(request);

        return ResponseEntity.ok("Friend request accepted");
    }

    @GetMapping("/{username}/requests")
    public List<Map<String, Object>> getPendingRequests(@PathVariable String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        List<FriendRequest> requests = friendRequestRepository.findByReceiverAndStatus(user, "PENDING");

        List<Map<String, Object>> result = new ArrayList<>();
        for (FriendRequest req : requests) {
            Map<String, Object> map = new HashMap<>();
            map.put("requestId", req.getId());
            map.put("sender", req.getSender().getUsername());
            result.add(map);
        }
        return result;
    }

    @GetMapping("/{username}/list")
    public List<String> getFriends(@PathVariable String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        List<FriendRequest> accepted = friendRequestRepository.findAllFriends(user);

        List<String> friends = new ArrayList<>();
        for (FriendRequest req : accepted) {
            if (req.getSender().equals(user)) {
                friends.add(req.getReceiver().getUsername());
            } else {
                friends.add(req.getSender().getUsername());
            }
        }
        return friends;
    }
}
