# NexaVoice — Authentication & Credential Security Specification

## 1. Password Security & Hashing

* **Algorithm**: `scrypt` (OWASP recommended password hashing algorithm).
* **Parameters**:
  * CPU/Memory Cost ($N$): `16384`
  * Block Size ($r$): `8`
  * Parallelization ($p$): `1`
  * Key Length: `64` bytes
  * Salt: 16 cryptographically secure random bytes generated via `node:crypto.randomBytes(16)`.
* **Verification**: Constant-time comparison using `crypto.timingSafeEqual` prevents timing side-channel attacks.
* **Storage Format**: `scrypt$N=16384,r=8,p=1$<salt-hex>$<hash-hex>`

---

## 2. Brute-Force & Abuse Mitigation

1. **Attempt Tracking**: Consecutive failed authentication attempts increment `User.failedLoginAttempts`.
2. **Lockout Policy**: After 5 consecutive failed attempts, the account is temporarily locked (`lockoutUntil = now + 15 minutes`).
3. **Anti-Enumeration Response**: Both unknown usernames and incorrect passwords return identical error responses (`401 Unauthorized: Invalid credentials`) to prevent username discovery.
4. **Security Audit**: Every failed login triggers a `LOGIN_FAILURE` security event recording IP address and timestamp.

---

## 3. Token Architecture

### 3.1 Access Tokens
* **Type**: Short-lived JSON Web Token (JWT).
* **Signing Algorithm**: HMAC-SHA256 (`HS256`).
* **TTL**: 900 seconds (15 minutes).
* **Payload Structure**:
  ```json
  {
    "sub": "user-uuid",
    "nexaVoiceId": "NV-8492-1940",
    "sid": "session-uuid",
    "tokenVersion": 1,
    "roles": ["USER"],
    "iat": 1790474959,
    "exp": 1790475859
  }
  ```
* **Instant Invalidation**: If a user logs out of all sessions or changes their password, `User.tokenVersion` is incremented. The `JwtAuthGuard` checks the token claim against the current database/cache version and rejects stale access tokens immediately.

### 3.2 Refresh Tokens
* **Type**: High-entropy 32-byte cryptographically secure random hex string (64 characters).
* **TTL**: 604,800 seconds (7 days).
* **Persistence**: Plaintext refresh tokens are **never** stored in the database. Only their SHA-256 hash (`tokenHash`) is persisted.
