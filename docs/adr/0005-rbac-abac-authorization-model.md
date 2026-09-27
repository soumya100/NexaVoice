# ADR-0005: Hybrid RBAC and ABAC Authorization Model

## Status
Accepted

## Context
NexaVoice manages complex, multi-tenant communication resources across individual users, group conversations, live calls, recordings, and autonomous AI agents. 

Simple Role-Based Access Control (RBAC) answers *what* a user is allowed to do generally (e.g. `conversation.read`), but cannot answer *which specific instances* a user may access (e.g. User A may only read Conversation X where they are an active participant, but not Conversation Y). 

Furthermore, autonomous AI assistants must not inherit human user authority without explicit capability grants and safety gating.

## Decision
We adopt a **Hybrid RBAC + ABAC + Capability Authorization Model**:

1. **RBAC (Coarse-Grained Roles & Permissions)**:
   * System and organization roles (`USER`, `MODERATOR`, `COMMUNITY_ADMIN`, `SYSTEM_ADMIN`) grant sets of discrete permissions (`<domain>.<action>`).
   * Evaluated at the request boundary by NestJS guards (`@RequirePermissions()`, `@RequireRoles()`).
2. **ABAC (Fine-Grained Contextual & Resource-Level Policies)**:
   * Evaluated inside application services via `AuthorizationDecisionService.authorize({ subject, action, resource, context })`.
   * Evaluates dynamic conditions:
     - Resource ownership (is `subject.id === resource.ownerId`?).
     - Membership (is `subject.id` in `resource.participants`?).
     - Resource state (is recording locked, deleted, or under legal hold?).
     - Account state (is user `ACTIVE`? Suspended/locked accounts cannot execute mutations).
3. **Capabilities**:
   * Ephemeral or situational privileges granted by contextual roles (e.g. `CALL_HOST`, `ROOM_MODERATOR`).
4. **AI Assistant Boundary**:
   * AI assistants possess a strictly partitioned permission matrix. The AI assistant does not inherit human owner permissions unless explicitly configured, and high-impact actions mandate human-in-the-loop approval.
5. **Defense-in-Depth**:
   * Guards provide perimeter defense at GraphQL resolvers and WebSocket gateways.
   * Domain application services re-verify authorization to prevent bypass via internal use cases.

## Consequences
* **Positive**: Fine-grained security, zero horizontal/vertical privilege escalation, auditable policy evaluation, and prevention of IDOR/BOLA attacks.
* **Negative**: Requires passing contextual metadata into application use cases and maintaining policy definition files.
