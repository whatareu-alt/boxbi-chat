package com.example.chatengine.serverspring;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MessageReactionRepository extends JpaRepository<MessageReaction, Long> {
    Optional<MessageReaction> findByMessageIdAndUsernameAndEmoji(Long messageId, String username, String emoji);
    List<MessageReaction> findByMessageId(Long messageId);
    void deleteByMessageId(Long messageId);
}
