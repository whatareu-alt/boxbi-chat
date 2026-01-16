package com.example.chatengine.serverspring;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class ChatMessage {
    @NotBlank(message = "Message type is required")
    private String type;

    @NotBlank(message = "Message content is required")
    @Size(max = 5000, message = "Message content must not exceed 5000 characters")
    private String content;

    @NotBlank(message = "Sender is required")
    private String sender;

    private long timestamp;

    public ChatMessage() {
    }

    public ChatMessage(String type, String content, String sender) {
        this.type = type;
        this.content = content;
        this.sender = sender;
        this.timestamp = System.currentTimeMillis();
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getSender() {
        return sender;
    }

    public void setSender(String sender) {
        this.sender = sender;
    }

    public long getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(long timestamp) {
        this.timestamp = timestamp;
    }
}
