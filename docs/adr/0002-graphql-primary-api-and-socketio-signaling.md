# ADR-0002: GraphQL Primary API and Socket.IO Signaling

## Status
Accepted

## Context
NexaVoice clients (Web, Mobile, Desktop) require flexible data fetching for complex UI hierarchies (e.g. conversations with participants, last messages, unread counts, and user presence) without over-fetching or multiple round-trips. Furthermore, realtime call signaling, presence, and messaging require bidirectional, low-latency communication.

## Decision
1. **GraphQL** will serve as the primary application API for data queries, mutations, and complex commands. Schema definition will follow the Code-First approach in NestJS, utilizing strong TypeScript types and DTO validation.
2. **Socket.IO over WebSockets** will be dedicated to realtime event transport: call signaling (SDP offer/answer, ICE candidates), participant state updates, typing indicators, presence, and live AI state.
3. **REST** will be reserved exclusively for infrastructure endpoints: health checks (`/health/live`, `/health/ready`), webhooks, file binary streaming/uploads, and OAuth callbacks.

## Consequences
* **Positive**: Optimized network payloads for mobile/web clients, strong typing across client and server, clear separation between query/mutation lifecycles and high-frequency event streaming.
* **Negative**: Requires handling both GraphQL complexity/depth protection and WebSocket connection lifecycle management with Redis adapters.
