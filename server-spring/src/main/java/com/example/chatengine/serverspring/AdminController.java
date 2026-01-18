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
        "http://127.0.0.1:*"
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

            System.out.println("🔴 ADMIN RESET: Deleted " + userCount + " users and " + messageCount + " messages");

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
