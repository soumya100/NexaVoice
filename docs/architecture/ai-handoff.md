# AI-To-Human Handoff & Screening Architecture

## AI-To-Human Transfer
Handoffs re-use the authoritative calling and transfer architecture built in Milestones 4, 5, and 6.

### Invariant: Single CallSession Lineage
* An AI-to-human transfer does **not** create a disconnected secondary call.
* The original `CallSession` remains active.
* The `AI_ASSISTANT` `CallParticipant` record transitions from `CONNECTED` to `LEFT` with a recorded `leftAt` timestamp.
* The `AISession` transitions to `HANDOFF` state with `handoffReason` and `handoffToUserId`.
* A transactional outbox event (`ai.handoff.requested`) is written atomically in the same database transaction.
* Human specialist participants join the existing call without losing call recording or transcript history.

## Inbound AI Screening & Mandatory Disclosure
Inbound calls routed to an automated AI screening assistant execute deterministic policy:

1. **Mandatory AI Disclosure**:
   Callers are explicitly notified immediately upon call establishment:
   > *"Hello. You have reached NexaVoice. Please be advised that this call is being answered by an automated AI assistant and recorded for quality assurance."*
   The system never conceals AI identity or misrepresents the assistant as a human operator.

2. **Deterministic Intent Classification**:
   * If caller indicates urgent issues, supervisor requests, or asks for a human: routes deterministically to `ROUTE_TO_HUMAN`.
   * If caller requests voicemail: routes to `ROUTE_TO_VOICEMAIL`.
   * General inquiries are processed by the virtual agent (`AI_RESOLVED`).

```
 Inbound PSTN/SIP Call
           │
           ▼
 Mandatory Disclosure Greeting
           │
           ▼
 Caller Purpose & Intent Capture
           │
 ┌─────────┴─────────────────────┐
 ▼                               ▼
Intent requires human         Inquiry resolvable
 │                               │
 ▼                               ▼
Atomic Transfer Lineage       AI Conversation & Tool Execution
(AI Participant LEFT,
 Human Participant JOINED)
```
