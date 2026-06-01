package com.example.chatengine.serverspring;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface OtpVerificationRepository extends JpaRepository<OtpVerification, Long> {
    Optional<OtpVerification> findByUsername(String username);
    Optional<OtpVerification> findByEmail(String email);
    Optional<OtpVerification> findByUsernameOrEmail(String username, String email);
    void deleteByUsername(String username);
    void deleteByEmail(String email);
}
