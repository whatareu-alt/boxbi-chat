package com.example.chatengine.serverspring.controller;

import com.example.chatengine.serverspring.repository.FriendRequestRepository;
import com.example.chatengine.serverspring.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/admin")
public class AdminController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private FriendRequestRepository friendRequestRepository;

    // 🔒 SECRET ADMIN PASSWORD
    // You should change this to something very strong!
    private static final String ADMIN_SECRET = "zoobi-super-secret-admin-key-2024";

    @DeleteMapping("/reset")
    public ResponseEntity<?> resetDatabase(@RequestParam String secret) {
        // Validate the secret key
        if (!ADMIN_SECRET.equals(secret)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Invalid admin secret key"));
        }

        try {
            System.out.println("⚠️ ADMIN RESET INITIATED ⚠️");

            // 1. Delete all friend requests first (due to foreign key constraints usually)
            friendRequestRepository.deleteAll();
            System.out.println("✅ All friend requests deleted");

            // 2. Delete all users
            userRepository.deleteAll();
            System.out.println("✅ All users deleted");

            return ResponseEntity.ok(Map.of("message", "Database successfully reset. All users and data deleted."));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to reset database: " + e.getMessage()));
        }
    }
}
