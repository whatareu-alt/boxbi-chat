package com.chatapp.controller;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.chatapp.model.AuthRequest;
import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;

/**
 * REST Controller for user authentication operations
 * Handles login and signup via Chat Engine API
 */
@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    @Value("${chat.engine.project-id}")
    private String projectId;

    @Value("${chat.engine.private-key}")
    private String privateKey;

    private static final String CHAT_ENGINE_API_URL = "https://api.chatengine.io";
    private static final Gson gson = new Gson();

    /**
     * Authenticates a user by verifying credentials with Chat Engine
     * 
     * @param request Authentication request containing username and secret
     * @return ResponseEntity with user data or error
     */
    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@RequestBody AuthRequest request) {
        HttpURLConnection connection = null;
        try {
            // Create GET request to Chat Engine
            URI uri = new URI(CHAT_ENGINE_API_URL + "/users/me");
            connection = (HttpURLConnection) uri.toURL().openConnection();
            connection.setRequestMethod("GET");

            // Set headers
            connection.setRequestProperty("Content-Type", "application/json");
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("Project-ID", projectId);
            connection.setRequestProperty("User-Name", request.getUsername());
            connection.setRequestProperty("User-Secret", request.getSecret());

            // Read response
            Map<String, Object> response = readResponse(connection);
            return new ResponseEntity<>(response, HttpStatus.OK);

        } catch (Exception e) {
            return handleException(e);
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
    }

    /**
     * Registers a new user via Chat Engine API
     * 
     * @param request Registration request with user details
     * @return ResponseEntity with created user data or error
     */
    @PostMapping("/signup")
    public ResponseEntity<Map<String, Object>> signup(@RequestBody AuthRequest request) {
        HttpURLConnection connection = null;
        try {
            // Create POST request to Chat Engine
            URI uri = new URI(CHAT_ENGINE_API_URL + "/users/");
            connection = (HttpURLConnection) uri.toURL().openConnection();
            connection.setRequestMethod("POST");

            // Set headers
            connection.setRequestProperty("Content-Type", "application/json");
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("Private-Key", privateKey);

            // Build request body
            connection.setDoOutput(true);
            Map<String, String> body = new HashMap<>();
            body.put("username", request.getUsername());
            body.put("secret", request.getSecret());
            body.put("email", request.getEmail());
            body.put("first_name", request.getFirstName());
            body.put("last_name", request.getLastName());

            // Write request body
            String jsonBody = new JSONObject(body).toString();
            try (OutputStream os = connection.getOutputStream()) {
                byte[] input = jsonBody.getBytes(StandardCharsets.UTF_8);
                os.write(input, 0, input.length);
            }

            // Read response
            Map<String, Object> response = readResponse(connection);
            return new ResponseEntity<>(response, HttpStatus.CREATED);

        } catch (Exception e) {
            return handleException(e);
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
    }

    /**
     * Reads JSON response from HTTP connection
     * 
     * @param connection The HTTP connection to read from
     * @return Parsed JSON response as Map
     */
    private Map<String, Object> readResponse(HttpURLConnection connection) throws Exception {
        StringBuilder responseStr = new StringBuilder();
        try (BufferedReader br = new BufferedReader(
                new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8))) {
            String responseLine;
            while ((responseLine = br.readLine()) != null) {
                responseStr.append(responseLine.trim());
            }
        }
        return gson.fromJson(responseStr.toString(),
                new TypeToken<HashMap<String, Object>>() {
                }.getType());
    }

    /**
     * Handles exceptions and returns appropriate error response
     * 
     * @param e The exception to handle
     * @return ResponseEntity with error details
     */
    private ResponseEntity<Map<String, Object>> handleException(Exception e) {
        e.printStackTrace();
        Map<String, Object> errorResponse = new HashMap<>();
        errorResponse.put("error", "Authentication failed");
        errorResponse.put("message", e.getMessage());
        return new ResponseEntity<>(errorResponse, HttpStatus.BAD_REQUEST);
    }
}
