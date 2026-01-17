package com.example.chatengine.serverspring;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/friends")
@CrossOrigin(origins = {
        "https://chatappboxbi.netlify.app",
        "https://zoobichatapp.netlify.app",
        "https://boxbi.online",
        "https://www.boxbi.online",
        "http://localhost:*",
        "https://*.netlify.app"
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
    public ResponseEntity<?> acceptRequest(@PathVariable Long id) {
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
    public ResponseEntity<?> rejectRequest(@PathVariable Long id) {
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
