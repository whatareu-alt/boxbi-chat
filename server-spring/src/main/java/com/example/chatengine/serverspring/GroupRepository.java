package com.example.chatengine.serverspring;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface GroupRepository extends JpaRepository<ChatGroup, Long> {
    List<ChatGroup> findByCreatedBy(String createdBy);
}
