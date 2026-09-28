# AI Tool Execution Engine & Security

## Overview
AI agents cannot dynamically execute arbitrary code or internal APIs. All tool interactions are governed by `AIToolRegistryService`.

## Tool Security Lifecycle

### 1. Allowlist Filtering
Each `AIAgentVersion` defines a strict allowlist of tools in `toolsJson`. If a model returns a tool call for a tool not present in the agent's allowlist, the invocation is blocked immediately:
* Emits a `ForbiddenException`.
* Logs an audit event with `action = 'AI_UNAUTHORIZED_TOOL_INVOCATION_BLOCKED'`.
* Never dispatches execution to internal services.

### 2. Schema Validation
All tool definitions specify a strict JSON schema:
* Parameters are validated against required keys and expected types.
* Malformed JSON or missing required fields throws `BadRequestException`.

### 3. Execution & Scoped Context
Handlers are executed with explicitly scoped application context:
* `userId`: Authenticated actor requesting or hosting the session.
* `callSessionId`: Verified session ID.
* No raw administrative database access is ever passed to the LLM.

### 4. Output Sanitization
Before any tool execution result is returned to the LLM context or caller transcript, `AIToolRegistryService.sanitizeToolOutput` scrubs sensitive data:
* Credentials, API keys, password hashes, auth tokens, private keys, and authorization headers are recursively stripped.
* PII minimization prevents accidental exfiltration of internal customer metadata to external AI vendors.

## Built-In Tool Definitions

| Tool Name | Description | Privileged | Requires Confirmation |
| :--- | :--- | :--- | :--- |
| `lookupCustomer` | Lookup profile, contact details, and account tier | No | No |
| `scheduleFollowUp` | Schedule calendar follow-up or consultation | No | Yes |
| `checkAvailability` | Query open representative support slots | No | No |
| `transferToHuman` | Escalate active call leg to human queue | Yes | No |
| `transferCall` | Transfer active call to specific operator or queue | Yes | No |
