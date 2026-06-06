package com.example.chatengine.serverspring;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface MessageRepository extends JpaRepository<ChatMessage, Long> {

    // Find all messages between two users (bidirectional conversation)
    @Query("SELECT m FROM ChatMessage m WHERE " +
            "(m.sender = :user1 AND m.recipient = :user2) OR " +
            "(m.sender = :user2 AND m.recipient = :user1) " +
            "ORDER BY m.timestamp ASC")
    List<ChatMessage> findConversationBetween(@Param("user1") String user1, @Param("user2") String user2);

    List<ChatMessage> findByGroupIdOrderByTimestamp(Long groupId);

    @org.springframework.data.jpa.repository.Modifying
    @jakarta.transaction.Transactional
    @Query("DELETE FROM ChatMessage m WHERE " +
            "(m.sender = :user1 AND m.recipient = :user2) OR " +
            "(m.sender = :user2 AND m.recipient = :user1)")
    void deleteConversationBetween(@Param("user1") String user1, @Param("user2") String user2);

    @org.springframework.data.jpa.repository.Modifying
    @jakarta.transaction.Transactional
    @Query("DELETE FROM ChatMessage m WHERE m.groupId = :groupId")
    void deleteByGroupId(@Param("groupId") Long groupId);

    @org.springframework.data.jpa.repository.Modifying
    @jakarta.transaction.Transactional
    void deleteBySenderOrRecipient(String sender, String recipient);

    @Query("SELECT m FROM ChatMessage m WHERE m.isDeleted = false AND m.content LIKE :query ESCAPE '\\' AND " +
           "(m.sender = :username OR m.recipient = :username OR " +
           "m.groupId IN (SELECT gm.group.id FROM GroupMember gm WHERE gm.username = :username)) " +
           "ORDER BY m.timestamp DESC")
    List<ChatMessage> searchMessages(@Param("query") String query, @Param("username") String username);
}
