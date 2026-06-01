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
        "http://localhost:*",
        "http://127.0.0.1:*",
        "https://boxbichat.netlify.app",
        "https://boxbi.online"
})
public class UserController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private OtpVerificationRepository otpVerificationRepository;

    @Autowired
    private EmailService emailService;

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

            if (email.isEmpty()) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "Email is required");
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

            // Check if email already exists
            boolean emailExists = userRepository.findAll().stream()
                    .anyMatch(u -> u.getEmail().equalsIgnoreCase(email));

            if (emailExists) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "Email already exists");
                return new ResponseEntity<>(error, HttpStatus.CONFLICT);
            }

            // Generate a random 6-digit OTP code
            String otp = String.format("%06d", new java.util.Random().nextInt(1000000));

            // Hash password with BCrypt
            String hashedPassword = passwordEncoder.encode(password);

            // Clean up any existing verifications for the same username or email
            otpVerificationRepository.findByUsername(username).ifPresent(otpVerificationRepository::delete);
            otpVerificationRepository.findByEmail(email).ifPresent(otpVerificationRepository::delete);

            // Create and save new pending OTP verification
            OtpVerification pending = new OtpVerification(
                    username,
                    email,
                    hashedPassword,
                    firstName,
                    lastName,
                    otp,
                    java.time.LocalDateTime.now().plusMinutes(5)
            );
            otpVerificationRepository.save(pending);

            // Send OTP email (gracefully falls back to console printing)
            emailService.sendOtpEmail(email, otp);

            // Return that OTP is required to complete signup
            Map<String, Object> response = new HashMap<>();
            response.put("otpRequired", true);
            response.put("email", email);
            response.put("username", username);

            return new ResponseEntity<>(response, HttpStatus.OK);
        } catch (Exception e) {
            e.printStackTrace();
            Map<String, Object> error = new HashMap<>();
            error.put("error", "Internal server error");
            return new ResponseEntity<>(error, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @CrossOrigin
    @PostMapping("/signup/verify")
    public ResponseEntity<?> verifySignup(@RequestBody Map<String, String> request) {
        try {
            String username = request.get("username");
            String email = request.get("email");
            String otp = request.get("otp");

            if (username == null || email == null || otp == null) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "Username, email, and OTP code are required");
                return new ResponseEntity<>(error, HttpStatus.BAD_REQUEST);
            }

            username = username.trim();
            email = email.trim();
            otp = otp.trim();

            // Find the pending verification
            java.util.Optional<OtpVerification> optPending = otpVerificationRepository.findByUsername(username);
            if (optPending.isEmpty()) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "No pending registration found for this username");
                return new ResponseEntity<>(error, HttpStatus.BAD_REQUEST);
            }

            OtpVerification pending = optPending.get();

            // Verify email matches
            if (!pending.getEmail().equalsIgnoreCase(email)) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "Email does not match registration details");
                return new ResponseEntity<>(error, HttpStatus.BAD_REQUEST);
            }

            // Verify OTP matches
            if (!pending.getOtp().equals(otp)) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "Invalid OTP code");
                return new ResponseEntity<>(error, HttpStatus.BAD_REQUEST);
            }

            // Verify not expired
            if (pending.isExpired()) {
                otpVerificationRepository.delete(pending);
                Map<String, Object> error = new HashMap<>();
                error.put("error", "OTP code has expired. Please sign up again.");
                return new ResponseEntity<>(error, HttpStatus.BAD_REQUEST);
            }

            // OTP is valid! Let's create the user
            User newUser = new User(
                    pending.getUsername(),
                    pending.getSecret(), // already hashed!
                    pending.getEmail(),
                    pending.getFirstName(),
                    pending.getLastName()
            );
            userRepository.save(newUser);

            // Clean up the verification record
            otpVerificationRepository.delete(pending);

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
