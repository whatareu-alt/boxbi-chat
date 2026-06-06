package com.example.chatengine.serverspring;

import jakarta.persistence.*;

@Entity
@Table(name = "blocked_users", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"blocker", "blocked"})
})
public class BlockedUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 50)
    private String blocker;

    @Column(nullable = false, length = 50)
    private String blocked;

    @Column(name = "created_at")
    private long createdAt;

    public BlockedUser() {
    }

    public BlockedUser(String blocker, String blocked) {
        this.blocker = blocker;
        this.blocked = blocked;
        this.createdAt = System.currentTimeMillis();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getBlocker() {
        return blocker;
    }

    public void setBlocker(String blocker) {
        this.blocker = blocker;
    }

    public String getBlocked() {
        return blocked;
    }

    public void setBlocked(String blocked) {
        this.blocked = blocked;
    }

    public long getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(long createdAt) {
        this.createdAt = createdAt;
    }
}
