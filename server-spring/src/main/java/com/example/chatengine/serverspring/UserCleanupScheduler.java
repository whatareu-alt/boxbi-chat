package com.example.chatengine.serverspring;

import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
public class UserCleanupScheduler {

    @Autowired
    private UserRepository userRepository;

    // Run every hour
    @Scheduled(cron = "0 0 * * * ?")
    @Transactional
    public void cleanupInactiveUsers() {
        // Delete users inactive for more than 24 hours
        LocalDateTime cutoff = LocalDateTime.now().minusHours(24);

        // You can adjust the days here. For testing, you might want to use minutes.
        // LocalDateTime cutoff = LocalDateTime.now().minusMinutes(30);

        System.out.println("Running user cleanup for users inactive since " + cutoff);
        userRepository.deleteByLastActiveBefore(cutoff);
    }
}
