package com.example.chatengine.serverspring.repository;

import com.example.chatengine.serverspring.model.FriendRequest;
import com.example.chatengine.serverspring.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface FriendRequestRepository extends JpaRepository<FriendRequest, Long> {

    // Find pending requests for a receiver
    List<FriendRequest> findByReceiverAndStatus(User receiver, String status);

    // Check if request already exists (bi-directional check ideally, or just one
    // way)
    @Query("SELECT fr FROM FriendRequest fr WHERE (fr.sender = :user1 AND fr.receiver = :user2) OR (fr.sender = :user2 AND fr.receiver = :user1)")
    Optional<FriendRequest> findExistingRequest(@Param("user1") User user1, @Param("user2") User user2);

    List<FriendRequest> findBySenderAndStatus(User sender, String status);

    // Find all accepted requests involving a user
    @Query("SELECT fr FROM FriendRequest fr WHERE (fr.sender = :user OR fr.receiver = :user) AND fr.status = 'ACCEPTED'")
    List<FriendRequest> findAllFriends(@Param("user") User user);
}
