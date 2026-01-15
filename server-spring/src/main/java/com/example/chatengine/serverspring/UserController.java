package com.example.chatengine.serverspring;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

@RestController
@CrossOrigin(origins = {
        "https://zoobichatapp.netlify.app",
        "http://localhost:*",
        "https://*.netlify.app"
})
public class UserController {

    @Autowired
    private UserRepository userRepository;

    @CrossOrigin
    @RequestMapping(path = "/login", method = RequestMethod.POST)
    public ResponseEntity<Map<String, Object>> getLogin(@RequestBody HashMap<String, String> request) {
        try {
            String username = request.get("username");
            String secret = request.get("secret");

            if (username == null || username.trim().isEmpty()) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "Username is required");
                return new ResponseEntity<>(error, HttpStatus.BAD_REQUEST);
            }

            // Check if user exists in DB
            Optional<User> userOpt = userRepository.findByUsername(username);

            if (userOpt.isEmpty()) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "User not found");
                return new ResponseEntity<>(error, HttpStatus.NOT_FOUND);
            }

            User user = userOpt.get();

            // Verify password/secret
            if (secret != null && !secret.equals(user.getSecret())) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "Invalid credentials");
                return new ResponseEntity<>(error, HttpStatus.UNAUTHORIZED);
            }

            // Return user data (without secret)
            Map<String, Object> response = new HashMap<>();
            response.put("username", user.getUsername());
            response.put("email", user.getEmail());
            response.put("first_name", user.getFirstName());
            response.put("last_name", user.getLastName());
            response.put("id", user.getId());

            return new ResponseEntity<>(response, HttpStatus.OK);
        } catch (Exception e) {
            e.printStackTrace();
            Map<String, Object> error = new HashMap<>();
            error.put("error", "Internal server error");
            return new ResponseEntity<>(error, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @CrossOrigin
    @RequestMapping(path = "/signup", method = RequestMethod.POST)
    public ResponseEntity<Map<String, Object>> newSignup(@RequestBody HashMap<String, String> request) {
        try {
            String username = request.get("username");
            String secret = request.get("secret");
            String email = request.get("email");
            String firstName = request.get("first_name");
            String lastName = request.get("last_name");

            if (username == null || username.trim().isEmpty()) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "Username is required");
                return new ResponseEntity<>(error, HttpStatus.BAD_REQUEST);
            }

            // Check if user already exists
            if (userRepository.findByUsername(username).isPresent()) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "Username already exists");
                return new ResponseEntity<>(error, HttpStatus.CONFLICT);
            }

            // Create new user in DB
            User newUser = new User(username, secret, email, firstName, lastName);
            userRepository.save(newUser);

            // Return user data (without secret)
            Map<String, Object> response = new HashMap<>();
            response.put("username", username);
            response.put("email", email);
            response.put("first_name", firstName);
            response.put("last_name", lastName);
            response.put("id", newUser.getId());

            return new ResponseEntity<>(response, HttpStatus.CREATED);
        } catch (Exception e) {
            e.printStackTrace();
            Map<String, Object> error = new HashMap<>();
            error.put("error", "Internal server error");
            return new ResponseEntity<>(error, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    @CrossOrigin
    @RequestMapping(path = "/users/search/{query}", method = RequestMethod.GET)
    public List<Map<String, Object>> searchUsers(@PathVariable String query) {
        List<Map<String, Object>> results = new ArrayList<>();

        List<User> users = userRepository
                .findByUsernameContainingIgnoreCaseOrFirstNameContainingIgnoreCaseOrLastNameContainingIgnoreCase(query,
                        query, query);

        for (User user : users) {
            Map<String, Object> publicProfile = new HashMap<>();
            publicProfile.put("username", user.getUsername());
            publicProfile.put("email", user.getEmail());
            publicProfile.put("first_name", user.getFirstName());
            publicProfile.put("last_name", user.getLastName());
            results.add(publicProfile);
        }
        return results;
    }
}
