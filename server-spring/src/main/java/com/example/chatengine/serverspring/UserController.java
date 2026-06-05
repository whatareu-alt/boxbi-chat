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

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

// CORS is configured globally in SecurityConfig — no @CrossOrigin annotations needed here.
@RestController
public class UserController {

    // Cryptographically secure random for OTP generation
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtUtil jwtUtil;
    @Autowired private OtpVerificationRepository otpVerificationRepository;
    @Autowired private EmailService emailService;
    @Autowired private PasswordResetOtpRepository passwordResetOtpRepository;

    // ─── Login ────────────────────────────────────────────────────────────────

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody LoginRequest request) {
        try {
            String username = Encode.forHtml(request.getUsername().trim());
            String password = request.getSecret();

            if (username.isEmpty()) {
                return error("Username is required", HttpStatus.BAD_REQUEST);
            }

            // Use indexed repository query — not findAll().stream().filter()
            Optional<User> optUser = userRepository.findByUsername(username);

            if (optUser.isEmpty() || !passwordEncoder.matches(password, optUser.get().getSecret())) {
                // Same error for missing user and wrong password — prevents user enumeration
                return error("Invalid credentials", HttpStatus.UNAUTHORIZED);
            }

            User user = optUser.get();
            user.setLastActive(java.time.LocalDateTime.now());
            userRepository.save(user);

            String token = jwtUtil.generateToken(user.getUsername());
            return ResponseEntity.ok(new AuthResponse(
                    token, user.getUsername(), user.getEmail(),
                    user.getFirstName(), user.getLastName(), user.getId()));

        } catch (RuntimeException e) {
            return error("Invalid credentials", HttpStatus.UNAUTHORIZED);
        } catch (Exception e) {
            return error("Internal server error", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // ─── Signup ───────────────────────────────────────────────────────────────

    @PostMapping("/signup")
    public ResponseEntity<?> signup(@Valid @RequestBody SignupRequest request) {
        try {
            String username  = Encode.forHtml(request.getUsername().trim());
            String email     = Encode.forHtml(request.getEmail().trim().toLowerCase());
            String firstName = request.getFirstName() != null ? Encode.forHtml(request.getFirstName().trim()) : "";
            String lastName  = request.getLastName()  != null ? Encode.forHtml(request.getLastName().trim())  : "";
            String password  = request.getSecret();

            if (username.isEmpty())  return error("Username is required", HttpStatus.BAD_REQUEST);
            if (email.isEmpty())     return error("Email is required",    HttpStatus.BAD_REQUEST);
            if (!username.matches("^[a-zA-Z0-9_]{3,30}$"))
                return error("Username must be 3–30 characters (letters, numbers, underscores)", HttpStatus.BAD_REQUEST);
            if (password == null || password.length() < 8)
                return error("Password must be at least 8 characters", HttpStatus.BAD_REQUEST);

            // Indexed queries — never findAll()
            if (userRepository.findByUsername(username).isPresent())
                return error("Username already exists", HttpStatus.CONFLICT);
            if (userRepository.findByEmailIgnoreCase(email).isPresent())
                return error("Email already exists", HttpStatus.CONFLICT);

            String otp            = generateSecureOtp();
            String hashedPassword = passwordEncoder.encode(password);

            otpVerificationRepository.findByUsername(username).ifPresent(otpVerificationRepository::delete);
            otpVerificationRepository.findByEmail(email).ifPresent(otpVerificationRepository::delete);

            OtpVerification pending = new OtpVerification(
                    username, email, hashedPassword, firstName, lastName,
                    otp, java.time.LocalDateTime.now().plusMinutes(5));
            otpVerificationRepository.save(pending);

            emailService.sendOtpEmail(email, otp);

            Map<String, Object> response = new HashMap<>();
            response.put("otpRequired", true);
            response.put("email", email);
            response.put("username", username);
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            return error("Internal server error", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // ─── Signup OTP verify ────────────────────────────────────────────────────

    @PostMapping("/signup/verify")
    public ResponseEntity<?> verifySignup(@RequestBody Map<String, String> request) {
        try {
            String username = nullSafeTrim(request.get("username"));
            String email    = nullSafeTrim(request.get("email"));
            String otp      = nullSafeTrim(request.get("otp"));

            if (username == null || email == null || otp == null)
                return error("Username, email, and OTP code are required", HttpStatus.BAD_REQUEST);

            Optional<OtpVerification> optPending = otpVerificationRepository.findByUsername(username);
            if (optPending.isEmpty())
                return error("No pending registration found", HttpStatus.BAD_REQUEST);

            OtpVerification pending = optPending.get();

            if (!pending.getEmail().equalsIgnoreCase(email))
                return error("Email does not match", HttpStatus.BAD_REQUEST);

            // Constant-time OTP comparison — prevents timing attacks
            if (!constantTimeEquals(pending.getOtp(), otp))
                return error("Invalid OTP code", HttpStatus.BAD_REQUEST);

            if (pending.isExpired()) {
                otpVerificationRepository.delete(pending);
                return error("OTP has expired. Please sign up again.", HttpStatus.BAD_REQUEST);
            }

            User newUser = new User(
                    pending.getUsername(), pending.getSecret(), // secret is already BCrypt-hashed
                    pending.getEmail(), pending.getFirstName(), pending.getLastName());
            userRepository.save(newUser);
            otpVerificationRepository.delete(pending);

            String token = jwtUtil.generateToken(newUser.getUsername());
            return ResponseEntity.status(HttpStatus.CREATED).body(
                    new AuthResponse(token, newUser.getUsername(), newUser.getEmail(),
                            newUser.getFirstName(), newUser.getLastName(), newUser.getId()));

        } catch (Exception e) {
            return error("Internal server error", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // ─── Password reset ───────────────────────────────────────────────────────

    @PostMapping("/password-reset/request")
    public ResponseEntity<?> requestPasswordReset(@RequestBody Map<String, String> request) {
        try {
            String email = nullSafeTrim(request.get("email"));
            if (email == null || email.isEmpty())
                return error("Email is required", HttpStatus.BAD_REQUEST);

            email = Encode.forHtml(email.toLowerCase());

            // Only send if the account exists — but ALWAYS return the same response
            // to prevent account enumeration
            Optional<User> optUser = userRepository.findByEmailIgnoreCase(email);
            if (optUser.isPresent()) {
                String otp = generateSecureOtp();
                passwordResetOtpRepository.findByEmail(email).ifPresent(passwordResetOtpRepository::delete);
                passwordResetOtpRepository.save(new PasswordResetOtp(
                        email, otp, java.time.LocalDateTime.now().plusMinutes(5)));
                emailService.sendPasswordResetEmail(email, otp);
            }

            // Identical response whether account exists or not
            Map<String, Object> response = new HashMap<>();
            response.put("message", "If an account with that email exists, a reset code has been sent.");
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            return error("Internal server error", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @PostMapping("/password-reset/confirm")
    public ResponseEntity<?> confirmPasswordReset(@RequestBody Map<String, String> request) {
        try {
            String email  = nullSafeTrim(request.get("email"));
            String otp    = nullSafeTrim(request.get("otp"));
            String secret = request.get("secret");

            if (email == null || otp == null || secret == null || secret.isEmpty())
                return error("Email, OTP, and new password are required", HttpStatus.BAD_REQUEST);
            if (secret.length() < 8)
                return error("Password must be at least 8 characters", HttpStatus.BAD_REQUEST);

            email = Encode.forHtml(email.toLowerCase());

            Optional<PasswordResetOtp> optPending = passwordResetOtpRepository.findByEmail(email);

            // Merge "not found" and "wrong OTP" to prevent enumeration
            if (optPending.isEmpty() || !constantTimeEquals(optPending.get().getOtp(), otp)) {
                return error("Invalid or expired reset code", HttpStatus.BAD_REQUEST);
            }

            PasswordResetOtp pending = optPending.get();
            if (pending.isExpired()) {
                passwordResetOtpRepository.delete(pending);
                return error("OTP has expired. Please request a new one.", HttpStatus.BAD_REQUEST);
            }

            Optional<User> optUser = userRepository.findByEmailIgnoreCase(email);
            if (optUser.isEmpty()) return error("User not found", HttpStatus.NOT_FOUND);

            User user = optUser.get();
            user.setSecret(passwordEncoder.encode(secret));
            userRepository.save(user);
            passwordResetOtpRepository.delete(pending);

            Map<String, Object> response = new HashMap<>();
            response.put("message", "Password reset successful");
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            return error("Internal server error", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // ─── User search ──────────────────────────────────────────────────────────

    @GetMapping("/users/search")
    public List<Map<String, Object>> searchUsers(@RequestParam(defaultValue = "") String username) {
        String q = Encode.forHtml(username.trim());

        List<User> users = q.isEmpty()
                ? List.of() // don't return all users when query is empty
                : userRepository.findByUsernameContainingIgnoreCaseOrFirstNameContainingIgnoreCaseOrLastNameContainingIgnoreCase(q, q, q);

        List<Map<String, Object>> results = new ArrayList<>();
        for (User user : users) {
            Map<String, Object> pub = new HashMap<>();
            pub.put("username",  user.getUsername());
            pub.put("firstName", user.getFirstName());
            pub.put("lastName",  user.getLastName());
            // Email intentionally omitted from search results
            results.add(pub);
        }
        return results;
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    /** Cryptographically secure 6-digit OTP */
    private static String generateSecureOtp() {
        return String.format("%06d", 100000 + SECURE_RANDOM.nextInt(900000));
    }

    /** Constant-time string comparison — prevents timing-based OTP brute-force */
    private static boolean constantTimeEquals(String a, String b) {
        if (a == null || b == null || a.length() != b.length()) return false;
        int diff = 0;
        for (int i = 0; i < a.length(); i++) diff |= a.charAt(i) ^ b.charAt(i);
        return diff == 0;
    }

    private static String nullSafeTrim(String s) {
        return s != null ? s.trim() : null;
    }

    private static ResponseEntity<Map<String, Object>> error(String message, HttpStatus status) {
        Map<String, Object> body = new HashMap<>();
        body.put("error", message);
        return ResponseEntity.status(status).body(body);
    }
}
