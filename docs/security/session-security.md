# NexaVoice — Session Security & Token Rotation Specification

## 1. Refresh Token Rotation & Reuse Detection Architecture

To defend against token theft, replay attacks, and man-in-the-middle leakage, NexaVoice implements **Single-Use Refresh Token Rotation with Immediate Revocation on Reuse**:

```
Client                             Server                             Database
  │                                  │                                   │
  ├────── refreshToken(RT_1) ───────►│                                   │
  │                                  ├────── Lookup tokenHash ──────────►│
  │                                  │◄───── Session Found ──────────────┤
  │                                  │                                   │
  │                                  ├────── Generate RT_2               │
  │                                  ├────── Update Session ────────────►│
  │                                  │       tokenHash = SHA256(RT_2)    │
  │                                  │       replacedBy = SHA256(RT_1)   │
  │◄───── New Tokens (AT_2, RT_2) ───┤                                   │
  │                                  │                                   │
═════════════════════════ ATTACK SCENARIO: TOKEN REUSE ═══════════════════════════
  │                                  │                                   │
Attacker presents stolen RT_1        │                                   │
  ├────── refreshToken(RT_1) ───────►│                                   │
  │                                  ├────── Check replacedByTokenHash ─►│
  │                                  │◄───── MATCH: REUSE DETECTED! ─────┤
  │                                  │                                   │
  │                                  ├────── IMMEDIATE MITIGATION ──────►│
  │                                  │       isRevoked = true            │
  │                                  │       reason = REUSE_DETECTED     │
  │                                  │       Audit: REFRESH_TOKEN_REUSE  │
  │◄───── 401 Unauthorized ──────────┤                                   │
  │       "Token reuse detected;     │                                   │
  │        session revoked"          │                                   │
```

---

## 2. Multi-Session & Device Security

* **Multi-Device Support**: A user can maintain concurrent active sessions across Web, Mobile (iOS/Android), and Desktop clients.
* **Per-Session State**: Each session tracks:
  * `id`: Unique session UUID.
  * `userId`: Associated user account.
  * `deviceId`: Associated hardware/browser client identifier.
  * `tokenHash`: Cryptographic fingerprint of active refresh token.
  * `replacedByTokenHash`: Audit trail of immediately preceding rotated token.
  * `isRevoked`: Boolean flag for instant revocation.
  * `lastActiveAt`: Timestamp of latest activity.
* **Remote Session Revocation**: Users can inspect active devices and revoke suspicious sessions individually or globally with `logout(allSessions: true)`.
