package com.example.chatengine.serverspring;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BlockedUserRepository extends JpaRepository<BlockedUser, Long> {
    boolean existsByBlockerAndBlocked(String blocker, String blocked);
    List<BlockedUser> findByBlocker(String blocker);
    Optional<BlockedUser> findByBlockerAndBlocked(String blocker, String blocked);
}
