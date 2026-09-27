# Contributing to NexaVoice

Thank you for your interest in contributing to NexaVoice.

## Development Workflow

1. **Strict TypeScript**: All code must compile cleanly with `npm run typecheck` under strict mode.
2. **Clean Architecture**:
   * Resolvers and WebSockets must remain thin adapters.
   * Business rules belong in domain entities and application use cases.
   * Never couple domain entities directly to external SDKs or Prisma models.
3. **Automated Testing**: Unit tests are required for new domain logic, permission policies, and use cases. Integration tests are required for database transactions and API endpoints.
4. **Security & Secrets**: Never commit secrets, credentials, or development certificates. All secrets must be loaded via validated environment variables.
5. **Architectural Decisions**: Major changes require an ADR in `docs/adr/`.
