# ADR-0003: Separation of Signaling and Media Planes

## Status
Accepted

## Context
High-concurrency audio and video calling introduces massive bandwidth and CPU demands when handling RTP/RTCP packet forwarding, encoding, transcoding, and selective forwarding (SFU). Routing raw audio/video streams through the application API gateway would lead to process starvation, memory bloat, high latency, and frequent server crashes.

## Decision
1. **NestJS Application Layer (Signaling Plane)**:
   * Only manages call setup, teardown, participant rosters, mute/hold state, SDP offer/answer exchange, ICE candidates routing, and call permissions.
   * Under no circumstances will raw media streams pass through NestJS or Socket.IO nodes.
2. **Media Infrastructure (Media Plane)**:
   * WebRTC peer-to-peer (P2P) for lightweight 1-on-1 calls where feasible.
   * Dedicated SFU (Selective Forwarding Unit) media servers (e.g. LiveKit, mediasoup, Janus) for group calls, recording pipelines, and conference streams.
   * STUN/TURN servers (e.g. Coturn) for NAT traversal.
3. Media providers will be accessed through clean abstract adapter interfaces (`IMediaServerAdapter`, `ITurnCredentialProvider`).

## Consequences
* **Positive**: The backend API remains fast, responsive, and horizontally scalable without high CPU/memory bottlenecks from video transcoding.
* **Negative**: Requires provisioning and orchestrating separate media server infrastructure in production environments.
