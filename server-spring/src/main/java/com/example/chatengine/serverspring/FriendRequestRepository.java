package com.example.chatengine.serverspring;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface FriendRequestRepository extends JpaRepository<FriendRequest, Long> {

        // Find request between two users
        Optional<FriendRequest> findBySenderUsernameAndReceiverUsername(String sender, String receiver);

        // Get all pending requests for a user (received)
        List<FriendRequest> findByReceiverUsernameAndStatus(String receiver, String status);

        // Get all requests sent by a user
        List<FriendRequest> findBySenderUsernameAndStatus(String sender, String status);

        // Check if two users are friends (accepted request exists)
        @Query("SELECT f FROM FriendRequest f " +
                        "WHERE ((f.senderUsername = :user1 AND f.receiverUsername = :user2) " +
                        "OR (f.senderUsername = :user2 AND f.receiverUsername = :user1)) " +
                        "AND f.status = 'ACCEPTED'")
        List<FriendRequest> findFriendship(@Param("user1") String user1, @Param("user2") String user2);

        default boolean areFriends(String user1, String user2) {
                return !findFriendship(user1, user2).isEmpty();
        }

        // Get all accepted friends for a user
        @Query("SELECT f FROM FriendRequest f " +
                        "WHERE (f.senderUsername = :username OR f.receiverUsername = :username) " +
                        "AND f.status = 'ACCEPTED'")
        List<FriendRequest> findAcceptedFriends(@Param("username") String username);
}
