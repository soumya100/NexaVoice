# ADR-0004: AI Assistant Safety and Action Policy Gateway

## Status
Accepted

## Context
NexaVoice features a personal AI assistant capable of participating in calls, screening incoming requests, managing messages, extracting tasks, and executing actions. Unchecked or autonomous execution of tools by LLMs presents critical risks of prompt injection, unauthorized data access, unintended calls or transfers, and privacy violations.

## Decision
1. **Never Impersonate Humans**: The AI assistant must always identify itself explicitly with distinct visual avatars, tags, and speech markers.
2. **Explicit Action Policy Gateway**:
   * Every action requested by the AI assistant produces an `AIActionRequest` domain entity.
   * Actions must pass through an `AIActionPolicyGateway` that evaluates the user's granular permission matrix (e.g. listening, speaking, messaging, calendar access, call ending).
   * High-impact actions (e.g., initiating calls, transferring calls, updating contact lists, accessing confidential memory) require explicit human-in-the-loop confirmation (`AIActionApproval`).
3. **Auditability**:
   * Every AI observation, planned tool call, policy evaluation, approval, and execution creates an immutable `AIActionAuditEvent`.
4. **Memory Boundary**:
   * Memory is partitioned with strict consent policies (e.g. user-approved only vs. ephemeral). Memory cannot be accessed across unauthorized boundaries.

## Consequences
* **Positive**: Robust security, defense-in-depth against prompt injection and autonomous hallucinations, compliance with privacy regulations.
* **Negative**: Introduces policy evaluation overhead and requires human approval flows in client UIs for high-impact actions.
