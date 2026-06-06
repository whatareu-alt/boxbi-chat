package com.example.chatengine.serverspring.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Function;

@Component
public class JwtUtil {

    private static final Logger log = LoggerFactory.getLogger(JwtUtil.class);

    // HS256 requires a key of at least 256 bits (32 bytes).
    private static final int MIN_SECRET_BYTES = 32;

    // Known insecure value that used to be committed as a default — reject it outright.
    private static final String INSECURE_DEFAULT =
            "boxbi-messenger-super-secret-key-change-this-in-production-2024";

    @Value("${jwt.secret:}")
    private String secret;

    @Value("${jwt.expiration:86400000}") // 24 hours in milliseconds
    private Long expiration;

    private SecretKey signingKey;

    @PostConstruct
    void initSigningKey() {
        if (secret == null || secret.isBlank() || secret.equals(INSECURE_DEFAULT)) {
            // No (or insecure) secret configured. Generate an ephemeral random key so tokens
            // are never forgeable with a publicly-known value. Tokens won't survive a restart —
            // acceptable for local dev; production MUST set a stable JWT_SECRET.
            signingKey = Keys.secretKeyFor(io.jsonwebtoken.SignatureAlgorithm.HS256);
            log.warn("JWT_SECRET is not set (or uses the old insecure default). " +
                    "Generated an ephemeral signing key — set JWT_SECRET (>= {} bytes) in production.",
                    MIN_SECRET_BYTES);
            return;
        }
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < MIN_SECRET_BYTES) {
            throw new IllegalStateException(
                    "jwt.secret must be at least " + MIN_SECRET_BYTES + " bytes; got " + keyBytes.length);
        }
        signingKey = Keys.hmacShaKeyFor(keyBytes);
    }

    private SecretKey getSigningKey() {
        return signingKey;
    }

    public String extractUsername(String token) {
        return extractClaim(token, Claims::getSubject);
    }

    public Date extractExpiration(String token) {
        return extractClaim(token, Claims::getExpiration);
    }

    public <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
        final Claims claims = extractAllClaims(token);
        return claimsResolver.apply(claims);
    }

    private Claims extractAllClaims(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    private Boolean isTokenExpired(String token) {
        return extractExpiration(token).before(new Date());
    }

    public String generateToken(String username) {
        Map<String, Object> claims = new HashMap<>();
        return createToken(claims, username);
    }

    private String createToken(Map<String, Object> claims, String subject) {
        return Jwts.builder()
                .claims(claims)
                .subject(subject)
                .issuedAt(new Date(System.currentTimeMillis()))
                .expiration(new Date(System.currentTimeMillis() + expiration))
                .signWith(getSigningKey())
                .compact();
    }

    public Boolean validateToken(String token, String username) {
        final String extractedUsername = extractUsername(token);
        return (extractedUsername.equals(username) && !isTokenExpired(token));
    }
}
