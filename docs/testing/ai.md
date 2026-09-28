# AI Testing Strategy & Provider Classification

## Provider Classification Standards

To maintain forensic honesty and avoid treating simulations as production validation, every AI component is strictly classified:

* `🟢 IMPLEMENTED + VALIDATED`: The capability is fully implemented in code, connected to real infrastructure, and validated with passing unit, integration, and security tests.
* `🟡 PARTIAL`: The capability is implemented in core interfaces and database, but lacks complete edge-case handling or background worker automation.
* `🔵 IMPLEMENTED BUT NOT VALIDATED`: Implemented in code, but awaiting automated test execution or runtime validation.
* `🟣 PROVIDER-DEPENDENT`: The capability interfaces with an external commercial cloud vendor (e.g., OpenAI, Anthropic Claude, ElevenLabs, Deepgram). It requires valid vendor API keys and runtime network connectivity.
* `🟠 MOCK / TEST DOUBLE`: In-memory deterministic test double used for automated test suites. Mocks are never reported as production functionality.
* `🔴 NOT IMPLEMENTED`: Not implemented or intentionally deferred to a future milestone (e.g., Billing, Customer Invoicing, Unrestricted Autonomous Outbound Campaigns).

## Test Suite Architecture

### 1. Unit & Security Tests (`backend/apps/api/src/modules/ai/ai.spec.ts`)
* **Agent Lifecycle & Versioning**: Tests initial version activation, immutable version creation, active version isolation, and terminal `ARCHIVED` status.
* **Tool Execution Engine**: Tests allowlist enforcement (`ForbiddenException`), schema validation (`BadRequestException`), and secret sanitization.
* **Orchestration & CallSession Integration**: Tests `AI_ASSISTANT` participant attachment to `CallSession`, prompt injection defense, and barge-in interruption.
* **Handoff & Screening**: Tests atomic transfer preserving `CallSession` lineage, transitioning AI participant to `LEFT`, outbox event generation, and mandatory disclosure screening.
* **Post-Call Intelligence & Background Worker**: Tests executive summary generation, action item extraction, and asynchronous outbox worker processing.
* **Provider Adapter Contracts**: Tests `MockAIProvider` (`🟠 MOCK / TEST DOUBLE`), `OpenAIAIProvider` (`🟣 PROVIDER-DEPENDENT`), and `AnthropicAIProvider` (`🟣 PROVIDER-DEPENDENT`).

### 2. Frontend Query & Domain Tests (`apps/web/src/test/ai.spec.ts`)
* Tests deterministic query key generation for `aiKeys`, `agentKeys`, `transcriptKeys`, `summaryKeys`, and `actionItemKeys`.
* Verifies targeted query cache invalidation without flushing the entire `QueryClient`.

### 3. Full Regression Suite
* Verifies that all 23 backend test suites (225 tests) and 11 web test suites (60 tests) pass with 0 regressions across authentication, messaging, WebRTC calling, conferencing, telephony, and PSTN/SIP.
