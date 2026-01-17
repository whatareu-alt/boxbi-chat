package com.example.chatengine.serverspring;

import com.example.chatengine.serverspring.dto.AuthResponse;
import com.example.chatengine.serverspring.dto.LoginRequest;
import com.example.chatengine.serverspring.dto.SignupRequest;
import com.example.chatengine.serverspring.security.JwtUtil;
import jakarta.validation.Valid;
import org.owasp.encoder.Encode;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
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
public class UserController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtUtil jwtUtil;

    @CrossOrigin
    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request) {
        try {
            // Sanitize input
            String username = Encode.forHtml(request.getUsername().trim());
            String password = request.getSecret();

            if (username.isEmpty()) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "Username is required");
                return new ResponseEntity<>(error, HttpStatus.BAD_REQUEST);
            }

            // Check if user exists in DB
            // Using defensive approach to handle potential duplicates
            java.util.List<User> users = userRepository.findAll().stream()
                    .filter(u -> u.getUsername().equals(username))
                    .toList();

            if (users.isEmpty()) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "Invalid credentials");
                return new ResponseEntity<>(error, HttpStatus.UNAUTHORIZED);
            }

            // If duplicates exist, use the first one (this shouldn't happen with proper
            // constraints)
            User user = users.get(0);

            // Verify password with BCrypt
            if (!passwordEncoder.matches(password, user.getSecret())) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "Invalid credentials");
                return new ResponseEntity<>(error, HttpStatus.UNAUTHORIZED);
            }

            // Update last active time
            user.setLastActive(java.time.LocalDateTime.now());
            userRepository.save(user);

            // Generate JWT token
            String token = jwtUtil.generateToken(user.getUsername());

            // Return user data with JWT token
            AuthResponse response = new AuthResponse(
                    token,
                    user.getUsername(),
                    user.getEmail(),
                    user.getFirstName(),
                    user.getLastName(),
                    user.getId());

            return new ResponseEntity<>(response, HttpStatus.OK);
        } catch (RuntimeException e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", e.getMessage());
            return new ResponseEntity<>(error, HttpStatus.UNAUTHORIZED);
        } catch (Exception e) {
            e.printStackTrace();
            Map<String, Object> error = new HashMap<>();
            error.put("error", "Internal server error");
            return new ResponseEntity<>(error, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @CrossOrigin
    @PostMapping("/signup")
    public ResponseEntity<?> signup(@Valid @RequestBody SignupRequest request) {
        try {
            // Sanitize input
            String username = Encode.forHtml(request.getUsername().trim());
            String email = Encode.forHtml(request.getEmail().trim());
            String firstName = request.getFirstName() != null ? Encode.forHtml(request.getFirstName().trim()) : "";
            String lastName = request.getLastName() != null ? Encode.forHtml(request.getLastName().trim()) : "";
            String password = request.getSecret();

            if (username.isEmpty()) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "Username is required");
                return new ResponseEntity<>(error, HttpStatus.BAD_REQUEST);
            }

            // Check if user already exists (defensive check for duplicates)
            java.util.List<User> existingUsers = userRepository.findAll().stream()
                    .filter(u -> u.getUsername().equals(username))
                    .toList();

            if (!existingUsers.isEmpty()) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "Username already exists");
                return new ResponseEntity<>(error, HttpStatus.CONFLICT);
            }

            // Hash password with BCrypt
            String hashedPassword = passwordEncoder.encode(password);

            // Create new user in DB
            User newUser = new User(username, hashedPassword, email, firstName, lastName);
            userRepository.save(newUser);

            // Generate JWT token
            String token = jwtUtil.generateToken(newUser.getUsername());

            // Return user data with JWT token
            AuthResponse response = new AuthResponse(
                    token,
                    newUser.getUsername(),
                    newUser.getEmail(),
                    newUser.getFirstName(),
                    newUser.getLastName(),
                    newUser.getId());

            return new ResponseEntity<>(response, HttpStatus.CREATED);
        } catch (Exception e) {
            e.printStackTrace();
            Map<String, Object> error = new HashMap<>();
            error.put("error", "Internal server error");
            return new ResponseEntity<>(error, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @CrossOrigin
    @GetMapping("/users/search")
    public List<Map<String, Object>> searchUsers(@RequestParam(defaultValue = "") String username) {
        List<Map<String, Object>> results = new ArrayList<>();

        // Sanitize search query
        String sanitizedQuery = Encode.forHtml(username.trim());

        List<User> users;
        if (sanitizedQuery.isEmpty()) {
            // Return all users if no query provided
            users = userRepository.findAll();
        } else {
            users = userRepository
                    .findByUsernameContainingIgnoreCaseOrFirstNameContainingIgnoreCaseOrLastNameContainingIgnoreCase(
                            sanitizedQuery, sanitizedQuery, sanitizedQuery);
        }

        for (User user : users) {
            Map<String, Object> publicProfile = new HashMap<>();
            publicProfile.put("username", user.getUsername());
            publicProfile.put("email", user.getEmail());
            publicProfile.put("firstName", user.getFirstName());
            publicProfile.put("lastName", user.getLastName());
            results.add(publicProfile);
        }
        return results;
    }
}
