package com.chatapp.model;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * DTO for user authentication requests
 */
public class AuthRequest {

    private String username;
    private String secret;
    private String email;

    @JsonProperty("first_name")
    private String firstName;

    @JsonProperty("last_name")
    private String lastName;

    // Constructors
    public AuthRequest() {
    }

    public AuthRequest(String username, String secret) {
        this.username = username;
        this.secret = secret;
    }

    // Getters and Setters
    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getSecret() {
        return secret;
    }

    public void setSecret(String secret) {
        this.secret = secret;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getFirstName() {
        return firstName;
    }

    public void setFirstName(String firstName) {
        this.firstName = firstName;
    }

    public String getLastName() {
        return lastName;
    }

    public void setLastName(String lastName) {
        this.lastName = lastName;
    }
}
