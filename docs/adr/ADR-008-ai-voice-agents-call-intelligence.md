# ADR-008: AI Voice, Agents & Call Intelligence Architecture

## Status
Accepted

## Context
NexaVoice requires an AI communication layer supporting AI voice participation, virtual agents, speech-to-text, text-to-speech, real-time voice conversations with barge-in interruption, AI call screening, human handoff, and post-call intelligence (summaries and action item extraction).

Prior milestones established a unified calling domain (`CallSession`, `CallLeg`, `CallParticipant`, `ConferenceSession`, `Room`). A critical architectural decision is required: should AI calling be modeled as a separate calling subsystem, or integrated natively into the existing calling architecture? Furthermore, how should external AI vendor dependencies (OpenAI, Anthropic, Deepgram, ElevenLabs) be abstracted?

## Decision
1. **Single Unified Call Architecture**:
   AI agents participate as first-class `CallParticipant` entities with `role = ParticipantRole.AI_ASSISTANT`. We do not duplicate call state machines, signaling gateways, or media pipelines for AI calls.
2. **First-Class AI Agent Domain with Immutable Versioning**:
   `AIAgent` defines agent business identity; `AIAgentVersion` stores immutable system instructions, model parameters, voice IDs, and tool allowlists. Running call sessions retain their starting version to prevent mid-call configuration shifts.
3. **Provider-Independent Abstraction Layer**:
   Core domain logic depends solely on `LLMProvider`, `SpeechToTextProvider`, `TextToSpeechProvider`, and `RealtimeVoiceProvider` interfaces. Vendor-specific APIs (OpenAI, Anthropic) reside exclusively inside adapters.
4. **Deterministic AI Safety Boundary**:
   Tool execution is gated by `AIToolRegistryService` enforcing agent allowlists, JSON schema validation, and credential sanitization. Caller dialogue is treated as untrusted input with prompt-injection defenses.
5. **Atomic Human Handoff with Single CallSession Lineage**:
   Escalations transition the AI participant to `LEFT` while preserving the original `CallSession` and adding human participants without creating an unrelated call.
6. **Asynchronous Post-Call Intelligence**:
   Summaries and action items are processed asynchronously via the transactional outbox and background worker (`AIWorker`), never blocking live call termination.
7. **No Billing**:
   In accordance with scope boundaries, token counts, audio duration, and latency are recorded strictly as usage metadata without billing or payment integration.

## Consequences
### Positive
* Single calling aggregate: WebRTC, SFU, SIP, and PSTN calls all seamlessly support AI voice agents without code duplication.
* Vendor portability: switching LLM or TTS vendors requires swapping the provider adapter without modifying conversation orchestration.
* Deterministic security: LLM cannot bypass tool allowlists or leak credentials to external providers.
* Auditability: all agent mutations, versions, sessions, handoffs, and tool executions are hash-chained in the security audit log.

### Negative / Trade-offs
* Real-time voice participation with low latency (<500ms) requires vendor API keys and WebSocket connections (`🟣 PROVIDER-DEPENDENT`).
* Local automated tests must use deterministic mocks (`🟠 MOCK / TEST DOUBLE`).
