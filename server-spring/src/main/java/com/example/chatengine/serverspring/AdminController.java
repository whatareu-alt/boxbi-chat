package com.example.chatengine.serverspring;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.Map;

@RestController
public class AdminController {

    private static final Logger log = LoggerFactory.getLogger(AdminController.class);
    private static final String KEY_ERROR = "error";
    private static final String ERR_DISABLED = "Admin endpoints are disabled";
    private static final String ERR_INVALID_SECRET = "Invalid admin secret code";

    // No fallback: admin endpoints are disabled unless ADMIN_RESET_SECRET is configured.
    private static final String ADMIN_SECRET = System.getenv("ADMIN_RESET_SECRET");

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private MessageRepository messageRepository;

    /** Constant-time secret check. Returns false when the server secret is not configured. */
    private static boolean isValidSecret(String provided) {
        if (ADMIN_SECRET == null || ADMIN_SECRET.isBlank() || provided == null) {
            return false;
        }
        return MessageDigest.isEqual(
                ADMIN_SECRET.getBytes(StandardCharsets.UTF_8),
                provided.getBytes(StandardCharsets.UTF_8));
    }

    @PostMapping("/admin/reset")
    public ResponseEntity<?> resetDatabase(@RequestBody Map<String, String> request) {
        try {
            if (ADMIN_SECRET == null || ADMIN_SECRET.isBlank()) {
                return new ResponseEntity<>(Map.of(KEY_ERROR, ERR_DISABLED),
                        HttpStatus.SERVICE_UNAVAILABLE);
            }

            if (!isValidSecret(request.get("secret"))) {
                return new ResponseEntity<>(Map.of(KEY_ERROR, ERR_INVALID_SECRET), HttpStatus.UNAUTHORIZED);
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

            log.warn("🔴 ADMIN RESET: Deleted {} users and {} messages", userCount, messageCount);

            return new ResponseEntity<>(response, HttpStatus.OK);

        } catch (Exception e) {
            log.error("Admin reset failed: {}", e.getMessage(), e);
            return new ResponseEntity<>(Map.of(KEY_ERROR, "Reset failed"), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @GetMapping("/admin/stats")
    public ResponseEntity<?> getDatabaseStats(@RequestParam String secret) {
        try {
            if (ADMIN_SECRET == null || ADMIN_SECRET.isBlank()) {
                return new ResponseEntity<>(Map.of(KEY_ERROR, ERR_DISABLED),
                        HttpStatus.SERVICE_UNAVAILABLE);
            }

            if (!isValidSecret(secret)) {
                return new ResponseEntity<>(Map.of(KEY_ERROR, ERR_INVALID_SECRET), HttpStatus.UNAUTHORIZED);
            }

            Map<String, Object> stats = new HashMap<>();
            stats.put("totalUsers", userRepository.count());
            stats.put("totalMessages", messageRepository.count());

            return new ResponseEntity<>(stats, HttpStatus.OK);

        } catch (Exception e) {
            log.error("Admin stats failed: {}", e.getMessage(), e);
            return new ResponseEntity<>(Map.of(KEY_ERROR, "Failed to get stats"), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
