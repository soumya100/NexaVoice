# AI Conversation Orchestration

## Architecture
The `AIOrchestrationService` coordinates turn-taking, prompt defenses, tool invocations, and speech synthesis without putting business logic in UI components or basic GraphQL resolvers.

```
       Inbound Audio Stream
                │
                ▼
      Speech Detection (VAD)
                │
                ▼
       Speech-To-Text (STT)
                │
                ▼
  Caller Dialogue Untrusted Framing
   (<caller_dialogue> Boundary)
                │
                ▼
     Agent Version Instructions
   + Allowlisted Tool Schemas
                │
                ▼
         LLM Provider
                │
       ┌────────┴────────┐
       ▼                 ▼
   Tool Invocation     Text Response
       │                 │
       ▼                 ▼
Schema Validation    Text-To-Speech (TTS)
+ Sanitization           │
       │                 ▼
       └──────────────► Outbound Call Media
```

## AISession State Machine
```
           ┌──────────────┐
           │ INITIALIZING │
           └──────┬───────┘
                  │
                  ▼
          ┌───────────────┐
   ┌─────►│   LISTENING   │◄─────────┐
   │      └───────┬───────┘          │
   │              │ user utterance   │
   │              ▼                  │
   │      ┌───────────────┐          │
   │      │   THINKING    │          │
   │      └───────┬───────┘          │
   │              │ tool call        │
   │              ▼                  │
   │      ┌───────────────┐          │
   │      │ TOOL_CALLING  │          │
   │      └───────┬───────┘          │
   │              │ response ready   │
   │              ▼                  │
   │      ┌───────────────┐          │
   │      │   SPEAKING    │──────────┘
   │      └───────┬───────┘  turn complete / interrupted
   │              │
   │              ▼ handoff requested
   │      ┌───────────────┐
   └──────┤    HANDOFF    │
          └───────┬───────┘
                  │ call ended
                  ▼
          ┌───────────────┐
          │   COMPLETED   │ (Terminal State)
          └───────────────┘
```

## Turn Attributions & Data Retention
Every conversational exchange creates an immutable `AITurn` row with:
* `speaker`: `USER`, `AGENT`, `SYSTEM`, or `TOOL`.
* `turnNumber`: Monotonically incrementing sequence number.
* `text`: Content spoken or returned.
* `isInterrupted`: Flag indicating whether the turn was cut short by barge-in.
* `latencyMs`: Generation and round-trip response latency.
* `toolCallsJson`: Record of tools invoked and sanitized results.
