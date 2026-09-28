# AI Security & Tenant Isolation Controls

## 1. Multi-Tenant Scoping
All AI entities are strictly tenant-isolated:
* `AIAgent` rows carry mandatory `organizationId`.
* Querying or mutating agents across organization boundaries is blocked at the resolver and service layer with `NotFoundException` or `ForbiddenException`.
* Outbound AI dialing or session attachment verifies caller organization membership before session initialization.

## 2. Scoped Permissions
NexaVoice defines 6 granular AI permissions in `packages/domain-types/src/authorization.ts`:
* `AI_AGENT_MANAGE`: Create, update, version, or archive AI agents.
* `AI_CALL_PARTICIPATE`: Connect an AI participant to an active call session.
* `AI_CALL_OUTBOUND`: Initiate automated outbound AI calls (requires explicit administrative enablement).
* `AI_TOOLS_EXECUTE`: Permit invocation of external tools during calls.
* `AI_TRANSCRIPT_READ`: Read diarized conversational transcripts.
* `AI_SUMMARIZE`: Generate or view executive call summaries and action items.

An agent existing in the database does not grant unrestricted access to all capabilities. Every capability requires explicit policy enablement.

## 3. Provider Credential Protection
* AI provider secrets (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, ElevenLabs keys) reside exclusively in backend environment configuration (`ConfigService`).
* Vendor API keys are **never** returned through GraphQL, REST endpoints, WebSocket events, or web client bundles.
* Clients interact strictly with the backend signaling gateway and GraphQL API.

## 4. IDOR & Session Guarding
* Access to transcripts, recordings, AI session turns, summaries, and action items is validated against caller participation or organization administration.
* Callers cannot access transcripts of sessions to which they were not a participant.

## 5. Audit Logging
Every AI operation emits a hash-chained, tamper-evident audit record via `SecurityAuditService`:
* `AI_AGENT_CREATED`
* `AI_AGENT_VERSION_CREATED`
* `AI_AGENT_VERSION_ACTIVATED`
* `AI_AGENT_STATUS_UPDATED`
* `AI_SESSION_STARTED`
* `AI_CALL_HUMAN_HANDOFF`
* `AI_UNAUTHORIZED_TOOL_INVOCATION_BLOCKED`
* `AI_TOOL_EXECUTED`
* `AI_PROMPT_INJECTION_DEFENSE_TRIGGERED`
* `AI_CALL_SUMMARY_GENERATED`
