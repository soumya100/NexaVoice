# AI Communication Architecture

## Overview
Milestone 7 introduces the AI communication layer to NexaVoice without creating a disconnected or redundant calling system. The AI layer integrates natively with the unified calling domain established in Milestones 4, 5, and 6 (`CallSession`, `CallLeg`, and `CallParticipant`).

## Core Principles
1. **First-Class Participant Model**: An AI agent participates in calls as a first-class `CallParticipant` with `role = ParticipantRole.AI_ASSISTANT`. It is neither modeled as a fake human user nor a client-side simulated entity.
2. **Unified Call Session Lifecycle**: All call states, signaling events, participant tracks, and transfer lineages remain strictly inside the authoritative `CallSession` aggregate.
3. **Provider-Agnostic Abstraction Layer**: Interfaces for `LLMProvider`, `SpeechToTextProvider`, `TextToSpeechProvider`, and `RealtimeVoiceProvider` decouple the orchestration engine from external AI vendors (OpenAI, Anthropic, Deepgram, ElevenLabs).
4. **Deterministic Security Boundary**: AI prompts, tool allowlists, and execution parameters are guarded by explicit policy services (`AIToolRegistryService`, `SecurityAuditService`) rather than relying solely on LLM prompt obedience.
5. **Separation of Planes**: Call signaling and application data flow via GraphQL and Socket.IO; media flows via WebRTC / SFU; raw audio is never sent over GraphQL subscriptions.
6. **No Billing**: In accordance with milestone boundaries, AI usage metadata (token counts, audio duration, turn latency) is logged for auditing and telemetry without invoice or billing logic.

```
                      CallSession Aggregate
                               │
       ┌───────────────────────┼────────────────────────┐
       ▼                       ▼                        ▼
 Human Participant      Human Participant        AI Participant
(role: PARTICIPANT)     (role: PARTICIPANT)   (role: AI_ASSISTANT)
                                                        │
                                                        ▼
                                                AISession Entity
                                                        │
                              ┌─────────────────────────┴────────────────────────┐
                              ▼                                                  ▼
                    Conversation State                               Realtime Media Session
                  (Turns, Tools, Latency)                           (STT / LLM / TTS Pipeline)
```
