package com.example.chatengine.serverspring;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface GroupMemberRepository extends JpaRepository<GroupMember, Long> {
    List<GroupMember> findByUsername(String username);

    List<GroupMember> findByGroup(ChatGroup group);

    boolean existsByGroupAndUsername(ChatGroup group, String username);
}
