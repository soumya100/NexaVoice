# NexaVoice — Milestone 2 Architecture Assessment
## Identity, Authentication, Authorization, RBAC & Security Foundation

**Date**: 2026-09-27  
**Status**: Completed & Approved  
**Author**: Principal Software Architect & Security Engineering Team  

---

## 1. Executive Summary

Following the completion of **Milestone 1 (Phase 0 — Modular Monolith Foundation)**, the project has a running NestJS modular monolith with strict TypeScript, GraphQL code-first schema generation, Socket.IO realtime signaling, Prisma ORM, Redis caching, structured observability, and a modern web client shell.

This assessment analyzes the current state and outlines the architectural blueprint for **Milestone 2: Identity, Authentication, Authorization, RBAC, ABAC/Capability Policies, and Session/Device Security**.

---

## 2. Inventory of Existing Implementation (Milestone 1 Baseline)

| Component | Current State | Reusability in Milestone 2 |
| :--- | :--- | :--- |
| **Monorepo Layout** | npm workspaces (`packages/*`, `database`, `backend/apps/*`, `apps/*`), strict `tsconfig.base.json`. | 100% reusable. |
| **Prisma Schema** | Base tables: `User`, `Session`, `Device`, `Contact`, `Conversation`, `Message`, `CallSession`, `AIProfile`, `AIAction`, `ConsentRecord`, `AuditEvent`. | Extensible. Requires schema additions for Account State transitions, Role/Permission models, Session revocation metadata, and Token reuse detection. |
| **NestJS API Module** | `AppModule`, `ConfigurationModule`, `DatabaseModule` (`PrismaService`), `CacheModule` (`RedisService`), `HealthModule`, `RealtimeModule` (`SignalingGateway`). | Solid foundation to integrate `AuthenticationModule`, `IdentityModule`, and `AuthorizationModule`. |
| **GraphQL Engine** | Apollo Server code-first with `/graphql` endpoint, playground, and schema stitching. | Directly reusable for `AuthResolver`, `UserResolver`, and `SecurityResolver`. |
| **Realtime Gateway** | Socket.IO `/realtime` namespace with call join/signal/leave events. | Ready for connection JWT handshake authentication and room authorization. |
| **Design Tokens & Shell** | `@nexavoice/design-tokens` & `@nexavoice/web` React shell. | Reusable for visualizing permissions, active sessions, and security event logs. |

---

## 3. Discovered Gaps & Security Risks

### 3.1 Authentication Gaps
1. **No Password Hashing or Credential Storage**: Password hashes in `User` table were stubbed; need OWASP-compliant `scrypt`/`pbkdf2` hasher with unique salt and constant-time comparison (`timingSafeEqual`).
2. **Missing Token Rotation & Reuse Detection**: Access tokens must be short-lived (15 minutes), while refresh tokens must rotate on every use. Presenting a previously exchanged refresh token must immediately trigger reuse detection, revoke all associated sessions, and emit a high-priority security audit event.
3. **No Session Revocation Metadata**: The current `Session` model lacks revocation reasons, device associations, and token replacement hashes.

### 3.2 Authorization & RBAC Gaps
1. **Simple Role Enum Insufficiency**: A single `UserRole` enum (`USER`, `MODERATOR`, `ADMIN`) violates the principle of granular access control.
2. **Absence of Resource-Level Authorization**: A user having permission `message.delete` or `conversation.read` must not be able to delete messages in conversations where they are not participants or authorized moderators.
3. **No ABAC / Contextual Policy Engine**: Missing contextual policy evaluation (`subject`, `action`, `resource`, `context`).
4. **AI Assistant Authority Leakage**: AI assistants must never inherit owner credentials or permissions by default. All AI actions must be mediated through an explicit AI permission matrix and safety gateway.

### 3.3 Database Gaps
1. **Account States**: Need explicit enum (`ACTIVE`, `PENDING_VERIFICATION`, `SUSPENDED`, `LOCKED`, `DEACTIVATED`, `DELETED`) with state transition enforcement.
2. **Normalized RBAC Models**: Tables needed for `Role`, `Permission`, `RolePermission`, `UserRoleAssignment`, and `AIPermissionAssignment`.
3. **Security Audit Log**: Normalized `SecurityEvent` entity with actor, target, action, result (`SUCCESS`, `FAILURE`, `DENIED`), IP, user agent, and correlation ID.

---

## 4. Target Architecture & Design Principles

### 4.1 Identity & Account State Machine
Every user receives an immutable internal UUID (`id`) and a unique public `nexaVoiceId` (e.g. `NV-XXXX-XXXX`), allowing usernames and display names to change without mutating the immutable core identifier.

```
       [Registration]
             ↓
    PENDING_VERIFICATION
             ↓ (Verify Email/Phone)
          ACTIVE ⇄ DEACTIVATED
        ↙        ↘
   SUSPENDED      LOCKED (Failed logins / Abuse)
        ↓
     DELETED (Retention / Cryptographic erasure)
```

### 4.2 Token & Session Security Architecture
* **Access Token**: Short-lived (15 mins), JWT signed with HMAC-SHA256, carrying `sub` (userId), `sid` (sessionId), `tokenVersion`, and active roles.
* **Refresh Token**: High-entropy cryptographically random string (64 chars). Only the SHA-256 hash is persisted in the database.
* **Reuse Detection**: Each session stores `tokenHash` and `replacedByTokenHash`. If a client presents a token matching `replacedByTokenHash`, the server identifies token theft, immediately revokes the session, and logs a security incident.
* **Session Invalidation**: Incrementing `User.tokenVersion` instantly invalidates all issued JWT access tokens without requiring database lookups on every request (verified via Redis or tokenVersion payload).

### 4.3 Clean Authorization Architecture (RBAC + ABAC + Capabilities)
```
GraphQL Resolver / WebSocket Gateway / Controller
                  ↓ (1. Request Authentication Guard)
            JwtAuthGuard
                  ↓ (2. Role & Permission Guards)
       RolesGuard / PermissionsGuard
                  ↓ (3. Use Case / Application Service)
        AuthorizationDecisionService
                  ↓ (4. Contextual Policy Engine)
      PolicyEngine (Subject, Action, Resource, Context)
                  ↓ (5. Audit Logging)
             SecurityEvent
```

### 4.4 Granular Permission Taxonomy
Permissions follow the `<domain>.<action>` format:
* `identity.read`, `identity.update`
* `profile.read`, `profile.update`
* `contact.read`, `contact.manage`
* `conversation.read`, `conversation.write`, `conversation.delete`
* `message.read`, `message.send`, `message.edit`, `message.delete`
* `call.join`, `call.invite`, `call.remove_participant`, `call.mute_participant`, `call.end`
* `recording.start`, `recording.stop`, `recording.delete`
* `ai.read`, `ai.configure`, `ai.listen`, `ai.speak`, `ai.join_call`, `ai.send_message`, `ai.make_call`, `ai.transfer_call`, `ai.end_call`
* `security.view_audit`, `security.manage_sessions`

---

## 5. Milestone 2 Implementation Plan

1. **Package Updates**: Add `@nestjs/jwt` and cryptography utilities to `@nexavoice/api`.
2. **Domain Contracts (`packages/domain-types`)**: Export `AccountState`, `Permission`, `Role`, `Capability`, and authorization decision payloads.
3. **Database Schema Enhancements (`database/prisma/schema.prisma`)**:
   * Add `AccountState` enum and lockout fields to `User`.
   * Add normalized `Role`, `Permission`, `RolePermission`, `UserRoleAssignment`, `AIPermissionAssignment`.
   * Add `replacedByTokenHash` and `revocationReason` to `Session`.
   * Add structured `SecurityEvent` model.
   * Generate updated Prisma client.
4. **Security & Cryptography Foundation**:
   * `PasswordHasher`: OWASP scrypt hashing with per-user salt and `timingSafeEqual`.
   * `TokenService`: JWT generation, verification, and SHA-256 fingerprinting.
5. **Authentication Module (`backend/apps/api/src/modules/authentication`)**:
   * Use cases: Register, Login, RefreshToken (with reuse detection), Logout, LogoutAllSessions.
   * GraphQL mutations and REST endpoints.
6. **Authorization Module (`backend/apps/api/src/modules/authorization`)**:
   * `AuthorizationDecisionService`: Centralized evaluation of Subject + Action + Resource + Context.
   * Policy handlers: Resource ownership, conversation membership, AI action safety boundary.
   * NestJS Decorators: `@RequirePermissions()`, `@RequireRoles()`, `@CurrentUser()`, `@CurrentSession()`, `@Public()`.
   * NestJS Guards: `JwtAuthGuard`, `PermissionsGuard`, `RolesGuard`.
7. **Socket.IO Realtime Gateway Security**:
   * Handshake authentication with JWT token verification.
   * Event authorization for room subscription and signaling.
8. **Security Audit Logging Service**:
   * Structured audit logging for login, session creation, revocation, role changes, and authorization denials.
9. **Automated Testing Suite**:
   * Unit tests: Password hashing, token rotation, reuse detection, permission evaluation, contextual policies, account state transitions.
   * Integration / E2E tests: GraphQL registration, login, refresh, session revocation, unauthorized query rejection, and Socket.IO auth.
10. **Documentation**:
    * `docs/security/authorization-matrix.md`
    * `docs/security/authentication.md`
    * `docs/security/authorization.md`
    * `docs/security/session-security.md`
    * `docs/adr/0005-rbac-abac-authorization-model.md`
