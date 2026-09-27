# NexaVoice

> Global, general-purpose communication platform with an integrated personal AI assistant.

NexaVoice combines personal messaging, voice & video calling, group conferences, screen sharing, PSTN telephony, and a personal AI assistant into a cohesive, secure, and privacy-conscious communication ecosystem.

---

## 🏗 System Architecture

NexaVoice is organized as a **modular monolith** with clear domain separation, designed to transition smoothly to distributed services as specific domains require independent scaling:

* **Backend (`backend/apps/api`)**: NestJS modular application using GraphQL (Mercurius/Apollo) as primary query/command interface and Socket.IO for realtime signaling & presence.
* **Database & Persistence (`database/prisma`)**: PostgreSQL managed via Prisma ORM.
* **Cache & Message Broker**: Redis / Valkey.
* **Shared Packages (`packages/*`)**:
  * `design-tokens`: Accessible design tokens (colors, typography, spacing, elevation).
  * `domain-types`: TypeScript domain contracts and interfaces.
* **Web App (`apps/web`)**: Modern, accessible React/Next.js application shell.
* **Infrastructure (`infrastructure/docker`)**: Local developer environment with PostgreSQL and Redis.

---

## 🚀 Getting Started

### Prerequisites
* Node.js `>= 20.0.0`
* npm `>= 10.0.0`
* Docker & Docker Compose (for local PostgreSQL & Redis)

### Installation
```bash
# Install all monorepo dependencies
npm install

# Start local infrastructure (Postgres, Redis)
npm run docker:dev

# Generate Prisma Client & Run Migrations
npm run prisma:generate

# Start the NestJS API
npm run start:api

# Start the Web Application Shell
npm run start:web
```

---

## 🛡 Security & Privacy

* **Strict Identity & Authentication**: JWT with secure refresh rotation, device sessions, remote logout.
* **AI Action Policy Gateway**: Granular permissions, explicit human-in-the-loop approvals for sensitive tools, full immutable audit trail.
* **Separation of Media & Signaling**: No media streams flow through application servers. WebRTC and dedicated SFUs handle media transport.
* See [SECURITY.md](./SECURITY.md) for vulnerability disclosure and policies.

---

## 📜 Documentation

* [Initial Architecture Assessment](./docs/architecture/initial-assessment.md)
* [ADR-0001: Modular Monolith Architecture](./docs/adr/0001-modular-monolith-architecture.md)
* [ADR-0002: GraphQL Primary API & Socket.IO Signaling](./docs/adr/0002-graphql-primary-api-and-socketio-signaling.md)
* [ADR-0003: Separation of Signaling and Media Planes](./docs/adr/0003-separation-of-signaling-and-media-planes.md)
* [ADR-0004: AI Assistant Safety & Action Policy Gateway](./docs/adr/0004-ai-assistant-safety-and-action-policy-gateway.md)
