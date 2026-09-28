# AI Agents & Versioning Domain

## Domain Entity Model
The AI Agent domain consists of two core relational entities: `AIAgent` and `AIAgentVersion`.

### AIAgent
Represents the durable business identity of a virtual agent within a tenant organization:
* `id`: Unique identifier (UUID).
* `organizationId`: Tenant isolation boundary.
* `name`: Display name (e.g., "Tier 1 Support Agent").
* `description`: Purpose and responsibility summary.
* `status`: Lifecycle state (`DRAFT`, `ACTIVE`, `DISABLED`, `ARCHIVED`).
* `activeVersionId`: Foreign key pointing to the currently active immutable version.

### AIAgentVersion
Represents an immutable snapshot of configuration:
* `id`: Version UUID.
* `agentId`: Parent agent reference.
* `version`: Monotonically incrementing integer (1, 2, 3...).
* `systemPrompt`: Base instructions and role constraints.
* `model`: LLM identifier (e.g., `gpt-4o`, `claude-3-5-sonnet-20241022`).
* `voiceId`: TTS voice persona (e.g., `alloy`, `echo`, `shimmer`).
* `voiceProvider`: TTS vendor (`openai`, `elevenlabs`, `mock-ai`).
* `temperature`: Sampling temperature (0.0 to 1.0).
* `toolsJson`: Explicit allowlist array of tool names permitted for invocation.
* `safetyPolicyJson`: Machine-readable constraints and disallowed topic policies.

## Immutable Versioning Invariant
When an AI agent is updated:
1. Active call sessions retain the exact `AIAgentVersion` ID that was active when the session started.
2. In-flight calls are never altered mid-call by configuration changes on the agent.
3. Editing an agent creates a new `AIAgentVersion` row.
4. Calling `activateVersion` switches the pointer `activeVersionId` for subsequent new calls.

## Lifecycle State Machine
```
   ┌─────────┐
   │  DRAFT  │
   └────┬────┘
        │ activate
        ▼
   ┌──────────┐   pause    ┌──────────┐
   │  ACTIVE  │ ─────────► │ DISABLED │
   │          │ ◄───────── │          │
   └────┬─────┘   resume   └────┬─────┘
        │                       │
        │ archive               │ archive
        └───────────┬───────────┘
                    ▼
              ┌───────────┐
              │ ARCHIVED  │ (Terminal State)
              └───────────┘
```
Archived agents cannot join new calls, cannot transition back to active, and are preserved strictly for audit and transcript lineage.
