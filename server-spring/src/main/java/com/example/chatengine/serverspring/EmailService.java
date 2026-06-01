package com.example.chatengine.serverspring;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class EmailService {

    @Autowired(required = false)
    private JavaMailSender mailSender;

    public void sendOtpEmail(String toEmail, String otp) {
        String subject = "Boxbi Messenger - Signup OTP Verification";
        String content = "Hello,\n\n"
                + "Thank you for signing up on Boxbi Messenger!\n"
                + "Your 6-digit OTP verification code is: " + otp + "\n\n"
                + "This OTP is valid for 5 minutes. Please enter it on the website to verify your registration.\n\n"
                + "Best regards,\n"
                + "The Boxbi Team";

        // Print details clearly to console for easy developer local testing
        System.out.println("----------------------------------------");
        System.out.println("📧 [OUTGOING EMAIL]");
        System.out.println("Recipient: " + toEmail);
        System.out.println("Subject:   " + subject);
        System.out.println("Content:   \n" + content);
        System.out.println("🔑 [OTP VERIFICATION CODE IS]: " + otp);
        System.out.println("----------------------------------------");

        if (mailSender != null) {
            try {
                SimpleMailMessage message = new SimpleMailMessage();
                message.setTo(toEmail);
                message.setSubject(subject);
                message.setText(content);
                mailSender.send(message);
                System.out.println("📧 [REAL EMAIL SENT SUCCESS] Email sent to " + toEmail);
            } catch (Exception e) {
                System.err.println("❌ [EMAIL ERROR] Failed to send real email to " + toEmail + ": " + e.getMessage());
            }
        } else {
            System.out.println("ℹ️ [EMAIL MOCK] JavaMailSender is not configured. (Use the OTP code logged above for verification)");
        }
    }
}
