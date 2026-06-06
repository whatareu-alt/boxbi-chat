package com.example.chatengine.serverspring;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

// CORS is configured globally in SecurityConfig — no @CrossOrigin annotations needed here.
@RestController
@RequestMapping("/friends")
public class FriendRequestController {

    private static final String STATUS_ACCEPTED = "ACCEPTED";
    private static final String STATUS_PENDING = "PENDING";
    private static final String KEY_ERROR = "error";
    private static final String KEY_MESSAGE = "message";

    private final FriendRequestRepository friendRequestRepository;
    private final UserRepository userRepository;

    public FriendRequestController(FriendRequestRepository friendRequestRepository,
                                   UserRepository userRepository) {
        this.friendRequestRepository = friendRequestRepository;
        this.userRepository = userRepository;
    }

    @PostMapping("/request")
    public ResponseEntity<Object> sendFriendRequest(@RequestBody Map<String, String> request,
                                                    java.security.Principal principal) {
        try {
            // Sender is always the authenticated user — never trusted from the body.
            String senderUsername = principal.getName();
            String receiverUsername = request.get("receiver");

            if (receiverUsername == null || receiverUsername.equals(senderUsername)) {
                return ResponseEntity.badRequest().body(Map.of(KEY_ERROR, "Invalid receiver"));
            }

            // Indexed lookup instead of loading every user.
            if (userRepository.findByUsername(receiverUsername).isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of(KEY_ERROR, "User not found"));
            }

            Optional<FriendRequest> existing = friendRequestRepository
                    .findBySenderUsernameAndReceiverUsername(senderUsername, receiverUsername);
            if (existing.isPresent()) {
                return ResponseEntity.badRequest().body(Map.of(KEY_ERROR, "Request already sent"));
            }

            Optional<FriendRequest> reverse = friendRequestRepository
                    .findBySenderUsernameAndReceiverUsername(receiverUsername, senderUsername);
            if (reverse.isPresent()) {
                if (reverse.get().getStatus().equals(STATUS_ACCEPTED)) {
                    return ResponseEntity.badRequest().body(Map.of(KEY_ERROR, "Already friends"));
                } else if (reverse.get().getStatus().equals(STATUS_PENDING)) {
                    return ResponseEntity.badRequest().body(Map.of(KEY_ERROR, "This user already sent you a request"));
                }
            }

            FriendRequest friendRequest = new FriendRequest(senderUsername, receiverUsername);
            friendRequestRepository.save(friendRequest);
            return ResponseEntity.ok(Map.of(KEY_MESSAGE, "Friend request sent", "id", friendRequest.getId()));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of(KEY_ERROR, "Failed to send request"));
        }
    }

    @GetMapping("/requests/pending")
    public ResponseEntity<Object> getPendingRequests(java.security.Principal principal) {
        try {
            String username = principal.getName();
            List<FriendRequest> requests = friendRequestRepository
                    .findByReceiverUsernameAndStatus(username, STATUS_PENDING);

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
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of(KEY_ERROR, "Failed to get requests"));
        }
    }

    @PostMapping("/accept/{id}")
    public ResponseEntity<Object> acceptRequest(@PathVariable long id, java.security.Principal principal) {
        try {
            Optional<FriendRequest> requestOpt = friendRequestRepository.findById(id);
            if (requestOpt.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of(KEY_ERROR, "Request not found"));
            }

            FriendRequest req = requestOpt.orElseThrow();
            // Only the receiver of a request may accept it.
            if (!req.getReceiverUsername().equals(principal.getName())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(KEY_ERROR, "Forbidden"));
            }
            req.setStatus(STATUS_ACCEPTED);
            friendRequestRepository.save(req);
            return ResponseEntity.ok(Map.of(KEY_MESSAGE, "Friend request accepted"));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of(KEY_ERROR, "Failed to accept request"));
        }
    }

    @PostMapping("/reject/{id}")
    public ResponseEntity<Object> rejectRequest(@PathVariable long id, java.security.Principal principal) {
        try {
            Optional<FriendRequest> requestOpt = friendRequestRepository.findById(id);
            if (requestOpt.isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of(KEY_ERROR, "Request not found"));
            }

            FriendRequest req = requestOpt.orElseThrow();
            // Only the receiver of a request may reject it.
            if (!req.getReceiverUsername().equals(principal.getName())) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(KEY_ERROR, "Forbidden"));
            }
            req.setStatus("REJECTED");
            friendRequestRepository.save(req);
            return ResponseEntity.ok(Map.of(KEY_MESSAGE, "Friend request rejected"));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of(KEY_ERROR, "Failed to reject request"));
        }
    }

    @GetMapping("/list")
    public ResponseEntity<Object> getFriendsList(java.security.Principal principal) {
        try {
            String username = principal.getName();
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
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of(KEY_ERROR, "Failed to get friends"));
        }
    }

    @GetMapping("/check/{username}")
    public ResponseEntity<Object> checkFriendship(@PathVariable String username, java.security.Principal principal) {
        try {
            String currentUser = principal.getName();
            boolean areFriends = friendRequestRepository.areFriends(currentUser, username);

            Optional<FriendRequest> pending = friendRequestRepository
                    .findBySenderUsernameAndReceiverUsername(currentUser, username);

            String status = "none";
            Long requestId = null;

            if (areFriends) {
                status = "friends";
            } else if (pending.isPresent() && pending.get().getStatus().equals(STATUS_PENDING)) {
                status = "pending_sent";
                requestId = pending.get().getId();
            } else {
                Optional<FriendRequest> reverse = friendRequestRepository
                        .findBySenderUsernameAndReceiverUsername(username, currentUser);
                if (reverse.isPresent() && reverse.get().getStatus().equals(STATUS_PENDING)) {
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
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of(KEY_ERROR, "Failed to check friendship"));
        }
    }

    @DeleteMapping("/{friend}")
    public ResponseEntity<Object> unfriend(@PathVariable String friend, java.security.Principal principal) {
        try {
            String currentUser = principal.getName();
            Optional<FriendRequest> friendship1 = friendRequestRepository
                    .findBySenderUsernameAndReceiverUsername(currentUser, friend);
            Optional<FriendRequest> friendship2 = friendRequestRepository
                    .findBySenderUsernameAndReceiverUsername(friend, currentUser);

            if (friendship1.isPresent() && friendship1.get().getStatus().equals(STATUS_ACCEPTED)) {
                friendRequestRepository.delete(friendship1.orElseThrow());
            } else if (friendship2.isPresent() && friendship2.get().getStatus().equals(STATUS_ACCEPTED)) {
                friendRequestRepository.delete(friendship2.orElseThrow());
            } else {
                return ResponseEntity.badRequest().body(Map.of(KEY_ERROR, "You are not friends with this user"));
            }

            return ResponseEntity.ok(Map.of(KEY_MESSAGE, "Unfriended successfully"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of(KEY_ERROR, "Failed to unfriend user"));
        }
    }
}
