# ADR-0001: Modular Monolith Architecture

## Status
Accepted

## Context
NexaVoice is envisioned as a global communication platform spanning messaging, calling, conferencing, AI assistance, social interaction, and developer platform features. 

Starting with a distributed microservices architecture introduces significant operational overhead, distributed transaction complexities, network latency, and deployment friction during early product iterations. Conversely, a monolithic structure without strict boundaries leads to spaghetti code, tight coupling, and difficult team scaling.

## Decision
We adopt a **Modular Monolith** pattern for the backend:
1. All domain modules reside within a unified codebase (`backend/apps/api` and `backend/libs/*`).
2. Modules communicate through explicit domain interfaces and application use cases, never by directly mutating each other's database tables or internal services.
3. Domain boundaries (Identity, Messaging, Calling, AI, Privacy, Billing) are strictly enforced.
4. When high-load services (e.g. Realtime Signaling Gateway or AI Worker) require independent scaling or resource profiles, they can be extracted cleanly into standalone processes without rewriting core domain logic.

## Consequences
* **Positive**: Fast local development, unified transactions where needed, simplified CI/CD, and consistent observability.
* **Negative**: Requires discipline to prevent accidental coupling between modules. Mitigated with linting, code reviews, and dependency inversion rules.
