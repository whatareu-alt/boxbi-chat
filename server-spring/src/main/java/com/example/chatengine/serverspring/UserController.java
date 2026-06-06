package com.example.chatengine.serverspring;

import com.example.chatengine.serverspring.dto.AuthResponse;
import com.example.chatengine.serverspring.dto.LoginRequest;
import com.example.chatengine.serverspring.dto.SignupRequest;
import com.example.chatengine.serverspring.security.JwtUtil;
import jakarta.validation.Valid;
import org.owasp.encoder.Encode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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

    private static final Logger log = LoggerFactory.getLogger(UserController.class);

    // Cryptographically secure random for OTP generation
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    // Max wrong OTP guesses before the code is invalidated — caps brute-force.
    private static final int MAX_OTP_ATTEMPTS = 5;
    private static final String ERR_INTERNAL = "Internal server error";
    private static final String ERR_USER_NOT_FOUND = "User not found";
    private static final String ERR_RESET_CODE = "Invalid or expired reset code";
    private static final String LOG_REQUEST_FAILED = "Request failed: {}";
    private static final String KEY_ERROR = "error";
    private static final String KEY_MESSAGE = "message";
    private static final String KEY_EMAIL = "email";
    private static final String KEY_USERNAME = "username";
    private static final String KEY_FIRST_NAME = "firstName";
    private static final String KEY_LAST_NAME = "lastName";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final OtpVerificationRepository otpVerificationRepository;
    private final EmailService emailService;
    private final PasswordResetOtpRepository passwordResetOtpRepository;
    private final BlockedUserRepository blockedUserRepository;
    private final FriendRequestRepository friendRequestRepository;
    private final MessageRepository messageRepository;

    public UserController(UserRepository userRepository,
                          PasswordEncoder passwordEncoder,
                          JwtUtil jwtUtil,
                          OtpVerificationRepository otpVerificationRepository,
                          EmailService emailService,
                          PasswordResetOtpRepository passwordResetOtpRepository,
                          BlockedUserRepository blockedUserRepository,
                          FriendRequestRepository friendRequestRepository,
                          MessageRepository messageRepository) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
        this.otpVerificationRepository = otpVerificationRepository;
        this.emailService = emailService;
        this.passwordResetOtpRepository = passwordResetOtpRepository;
        this.blockedUserRepository = blockedUserRepository;
        this.friendRequestRepository = friendRequestRepository;
        this.messageRepository = messageRepository;
    }

    // ─── Login ────────────────────────────────────────────────────────────────

    @PostMapping("/login")
    public ResponseEntity<Object> login(@Valid @RequestBody LoginRequest request) {
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
            return error(ERR_INTERNAL, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // ─── Signup ───────────────────────────────────────────────────────────────

    @PostMapping("/signup")
    public ResponseEntity<Object> signup(@Valid @RequestBody SignupRequest request) {
        try {
            String username  = Encode.forHtml(request.getUsername().trim());
            String email     = Encode.forHtml(request.getEmail().trim().toLowerCase());
            // Names are stored raw; the frontend escapes at render (escapeHtml/textContent).
            String firstName = request.getFirstName() != null ? request.getFirstName().trim() : "";
            String lastName  = request.getLastName()  != null ? request.getLastName().trim()  : "";
            String password  = request.getSecret();

            if (username.isEmpty())  return error("Username is required", HttpStatus.BAD_REQUEST);
            if (email.isEmpty())     return error("Email is required",    HttpStatus.BAD_REQUEST);
            if (!username.matches("^\\w{3,30}$"))
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
            response.put(KEY_EMAIL, email);
            response.put(KEY_USERNAME, username);
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            return error(ERR_INTERNAL, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // ─── Signup OTP verify ────────────────────────────────────────────────────

    @PostMapping("/signup/verify")
    public ResponseEntity<Object> verifySignup(@RequestBody Map<String, String> request) {
        try {
            String username = nullSafeTrim(request.get(KEY_USERNAME));
            String email    = nullSafeTrim(request.get(KEY_EMAIL));
            String otp      = nullSafeTrim(request.get("otp"));

            if (username == null || email == null || otp == null)
                return error("Username, email, and OTP code are required", HttpStatus.BAD_REQUEST);

            Optional<OtpVerification> optPending = otpVerificationRepository.findByUsername(username);
            if (optPending.isEmpty())
                return error("No pending registration found", HttpStatus.BAD_REQUEST);

            OtpVerification pending = optPending.get();

            if (!pending.getEmail().equalsIgnoreCase(email))
                return error("Email does not match", HttpStatus.BAD_REQUEST);

            if (pending.isExpired()) {
                otpVerificationRepository.delete(pending);
                return error("OTP has expired. Please sign up again.", HttpStatus.BAD_REQUEST);
            }

            // Constant-time OTP comparison — prevents timing attacks
            if (!constantTimeEquals(pending.getOtp(), otp)) {
                pending.setAttempts(pending.getAttempts() + 1);
                if (pending.getAttempts() >= MAX_OTP_ATTEMPTS) {
                    otpVerificationRepository.delete(pending);
                    return error("Too many invalid attempts. Please sign up again.", HttpStatus.BAD_REQUEST);
                }
                otpVerificationRepository.save(pending);
                return error("Invalid OTP code", HttpStatus.BAD_REQUEST);
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
            return error(ERR_INTERNAL, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // ─── Password reset ───────────────────────────────────────────────────────

    @PostMapping("/password-reset/request")
    public ResponseEntity<Object> requestPasswordReset(@RequestBody Map<String, String> request) {
        try {
            String email = nullSafeTrim(request.get(KEY_EMAIL));
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
            response.put(KEY_MESSAGE,"If an account with that email exists, a reset code has been sent.");
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            return error(ERR_INTERNAL, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @PostMapping("/password-reset/confirm")
    public ResponseEntity<Object> confirmPasswordReset(@RequestBody Map<String, String> request) {
        try {
            String email  = nullSafeTrim(request.get(KEY_EMAIL));
            String otp    = nullSafeTrim(request.get("otp"));
            String secret = request.get("secret");

            if (email == null || otp == null || secret == null || secret.isEmpty())
                return error("Email, OTP, and new password are required", HttpStatus.BAD_REQUEST);
            if (secret.length() < 8)
                return error("Password must be at least 8 characters", HttpStatus.BAD_REQUEST);

            email = Encode.forHtml(email.toLowerCase());

            Optional<PasswordResetOtp> optPending = passwordResetOtpRepository.findByEmail(email);

            // Single generic message for not-found / expired / wrong / exhausted — prevents enumeration.
            if (optPending.isEmpty()) {
                return error(ERR_RESET_CODE, HttpStatus.BAD_REQUEST);
            }

            PasswordResetOtp pending = optPending.get();
            if (pending.isExpired()) {
                passwordResetOtpRepository.delete(pending);
                return error(ERR_RESET_CODE, HttpStatus.BAD_REQUEST);
            }

            if (!constantTimeEquals(pending.getOtp(), otp)) {
                pending.setAttempts(pending.getAttempts() + 1);
                if (pending.getAttempts() >= MAX_OTP_ATTEMPTS) {
                    passwordResetOtpRepository.delete(pending);
                } else {
                    passwordResetOtpRepository.save(pending);
                }
                return error(ERR_RESET_CODE, HttpStatus.BAD_REQUEST);
            }

            Optional<User> optUser = userRepository.findByEmailIgnoreCase(email);
            if (optUser.isEmpty()) return error(ERR_USER_NOT_FOUND, HttpStatus.NOT_FOUND);

            User user = optUser.get();
            user.setSecret(passwordEncoder.encode(secret));
            userRepository.save(user);
            passwordResetOtpRepository.delete(pending);

            Map<String, Object> response = new HashMap<>();
            response.put(KEY_MESSAGE,"Password reset successful");
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            return error(ERR_INTERNAL, HttpStatus.INTERNAL_SERVER_ERROR);
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
            pub.put(KEY_USERNAME,  user.getUsername());
            pub.put(KEY_FIRST_NAME, user.getFirstName());
            pub.put(KEY_LAST_NAME,  user.getLastName());
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

    // ─── Profile Update ────────────────────────────────────────────────────────
    @PutMapping("/users/{username}")
    public ResponseEntity<Object> updateProfile(@PathVariable String username, @RequestBody Map<String, String> payload, java.security.Principal principal) {
        try {
            if (!principal.getName().equals(username)) {
                return error("Forbidden", HttpStatus.FORBIDDEN);
            }
            String firstName = payload.get(KEY_FIRST_NAME);
            String lastName = payload.get(KEY_LAST_NAME);
            String email = payload.get(KEY_EMAIL);
            String bio = payload.get("bio");

            if (firstName == null || lastName == null || email == null) {
                return error("Missing required fields", HttpStatus.BAD_REQUEST);
            }

            Optional<User> optUser = userRepository.findByUsername(username);
            if (optUser.isEmpty()) {
                return error(ERR_USER_NOT_FOUND, HttpStatus.NOT_FOUND);
            }

            User user = optUser.get();
            user.setFirstName(firstName.trim());
            user.setLastName(lastName.trim());
            user.setEmail(email.trim().toLowerCase());
            user.setBio(bio != null ? bio.trim() : "");
            userRepository.save(user);

            return ResponseEntity.ok(Map.of(KEY_MESSAGE,"Profile updated successfully"));
        } catch (Exception e) {
            log.error(LOG_REQUEST_FAILED, e.getMessage(), e);
            return error(ERR_INTERNAL, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // ─── Delete Account ────────────────────────────────────────────────────────
    @DeleteMapping("/users/{username}")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<Object> deleteAccount(@PathVariable String username, java.security.Principal principal) {
        try {
            if (!principal.getName().equals(username)) {
                return error("Forbidden", HttpStatus.FORBIDDEN);
            }

            Optional<User> optUser = userRepository.findByUsername(username);
            if (optUser.isEmpty()) {
                return error(ERR_USER_NOT_FOUND, HttpStatus.NOT_FOUND);
            }

            // Clean up messages and friend requests
            messageRepository.deleteBySenderOrRecipient(username, username);
            friendRequestRepository.deleteBySenderUsernameOrReceiverUsername(username, username);

            // Delete user entity
            userRepository.delete(optUser.orElseThrow());

            return ResponseEntity.ok(Map.of(KEY_MESSAGE,"Account deleted successfully"));
        } catch (Exception e) {
            log.error(LOG_REQUEST_FAILED, e.getMessage(), e);
            return error(ERR_INTERNAL, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // ─── Blocking / Unblocking ──────────────────────────────────────────────────
    @PostMapping("/users/{username}/block")
    public ResponseEntity<Object> blockUser(@PathVariable String username, java.security.Principal principal) {
        try {
            String blocker = principal.getName();
            if (blocker.equals(username)) {
                return error("Cannot block yourself", HttpStatus.BAD_REQUEST);
            }

            Optional<User> target = userRepository.findByUsername(username);
            if (target.isEmpty()) {
                return error(ERR_USER_NOT_FOUND, HttpStatus.NOT_FOUND);
            }

            if (blockedUserRepository.existsByBlockerAndBlocked(blocker, username)) {
                return error("Already blocked", HttpStatus.CONFLICT);
            }

            BlockedUser blockedUser = new BlockedUser(blocker, username);
            blockedUserRepository.save(blockedUser);

            // Auto-unfriend on block
            Optional<FriendRequest> friendship1 = friendRequestRepository.findBySenderUsernameAndReceiverUsername(blocker, username);
            Optional<FriendRequest> friendship2 = friendRequestRepository.findBySenderUsernameAndReceiverUsername(username, blocker);
            friendship1.ifPresent(friendRequestRepository::delete);
            friendship2.ifPresent(friendRequestRepository::delete);

            return ResponseEntity.ok(Map.of(KEY_MESSAGE,"User blocked successfully"));
        } catch (Exception e) {
            log.error(LOG_REQUEST_FAILED, e.getMessage(), e);
            return error(ERR_INTERNAL, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @DeleteMapping("/users/{username}/block")
    public ResponseEntity<Object> unblockUser(@PathVariable String username, java.security.Principal principal) {
        try {
            String blocker = principal.getName();
            Optional<BlockedUser> relation = blockedUserRepository.findByBlockerAndBlocked(blocker, username);
            if (relation.isEmpty()) {
                return error("User not blocked", HttpStatus.NOT_FOUND);
            }

            blockedUserRepository.delete(relation.orElseThrow());
            return ResponseEntity.ok(Map.of(KEY_MESSAGE,"User unblocked successfully"));
        } catch (Exception e) {
            log.error(LOG_REQUEST_FAILED, e.getMessage(), e);
            return error(ERR_INTERNAL, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @GetMapping("/users/blocked")
    public ResponseEntity<Object> getBlockedUsers(java.security.Principal principal) {
        try {
            String blocker = principal.getName();
            List<BlockedUser> blockedList = blockedUserRepository.findByBlocker(blocker);
            List<Map<String, Object>> response = new ArrayList<>();
            for (BlockedUser bu : blockedList) {
                Optional<User> uOpt = userRepository.findByUsername(bu.getBlocked());
                if (uOpt.isPresent()) {
                    User u = uOpt.get();
                    Map<String, Object> data = new HashMap<>();
                    data.put(KEY_USERNAME, u.getUsername());
                    data.put(KEY_FIRST_NAME, u.getFirstName());
                    data.put(KEY_LAST_NAME, u.getLastName());
                    response.add(data);
                }
            }
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error(LOG_REQUEST_FAILED, e.getMessage(), e);
            return error(ERR_INTERNAL, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    private static ResponseEntity<Object> error(String message, HttpStatus status) {
        Map<String, Object> body = new HashMap<>();
        body.put(KEY_ERROR, message);
        return ResponseEntity.status(status).body(body);
    }
}
