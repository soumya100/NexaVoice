# NexaVoice Identity and Authorization Architecture

## 1. Identity Model

NexaVoice enforces a strict, multi-tiered identity architecture designed for global portability and privacy:

```text
User Account
├── Immutable Internal UUID (id: UUIDv4)
├── Canonical NexaVoice ID (nexaVoiceId: "NV-XXXX-XXXX")
├── Mutable Public Identity (username, displayName, avatarUrl)
├── Verified Contact Channels (optional email, optional phone)
├── Account State (ACTIVE, PENDING_VERIFICATION, SUSPENDED, LOCKED, DEACTIVATED, DELETED)
├── Cryptographic Security State (passwordHash, tokenVersion, lockoutUntil)
├── Registered Devices (Web, iOS, Android, Desktop)
├── Active Sessions (rotating refresh tokens, IP, user-agent)
├── Role Assignments (USER, MODERATOR, SECURITY_ADMIN, etc.)
└── Personal AI Assistant Profile (name, voiceStyle, permissions)
```

### Immutable User Identifier vs. Public Handle
* **Internal UUID**: Primary foreign key across all database tables; never exposed in URLs or client-facing query parameters.
* **NexaVoice ID (`nexaVoiceId`)**: Globally unique, high-entropy stable user identifier (e.g. `NV-8492-1940`). Allows users to change their public `@username` without invalidating existing contacts, call histories, or encryption keys.

---

## 2. Account State Machine

```
              ┌─────────────────────────────┐
              │    PENDING_VERIFICATION     │
              └──────────────┬──────────────┘
                             │ (Verification complete)
                             ▼
              ┌─────────────────────────────┐
              │           ACTIVE            │◄──────────┐
              └───────┬───────┬───────┬─────┘           │
                      │       │       │                 │
     (Failed Logins)  │       │       │ (User Inactive) │ (Reactivate)
          ▼           │       ▼       │                 │
    ┌───────────┐     │  ┌──────────┐ │                 │
    │  LOCKED   │     │  │SUSPENDED │ │                 │
    └─────┬─────┘     │  └────┬─────┘ │                 │
          │           │       │       ▼                 │
   (Admin/Time Reset) │       │  ┌──────────────┐       │
          └───────────┼───────┼──┤ DEACTIVATED  ├───────┘
                      │       │  └──────────────┘
                      ▼       ▼
              ┌─────────────────────────────┐
              │           DELETED           │ (Terminal)
              └─────────────────────────────┘
```

Valid state transitions are validated by `canTransitionAccountState(from, to)`.

---

## 3. Defense-in-Depth Authorization Architecture

1. **Edge / Gateway Perimeter (Request Layer)**:
   * `JwtAuthGuard`: Validates Bearer token authenticity, expiration, user account state, and `tokenVersion`.
   * `RolesGuard`: Evaluates whether the requester holds required system roles.
   * `PermissionsGuard`: Evaluates whether the requester holds required granular permissions.
2. **Domain Service Enforcement (Application Layer)**:
   * `AuthorizationDecisionService.authorize({ subject, action, resource, context })`: Evaluates dynamic contextual rules (resource ownership, conversation membership, call host state, legal hold).
   * Prevents internal bypass if use cases are invoked outside standard HTTP/GraphQL controllers.
3. **Audit Verification (Audit Layer)**:
   * Sensitive decisions, role changes, and authorization denials automatically generate immutable `SecurityEvent` log entries.
