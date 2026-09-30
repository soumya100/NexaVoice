# NexaVoice Architecture: Social Communication Ecosystem

## 1. Executive Summary
Milestone 8 establishes the complete **Social Communication Ecosystem** for NexaVoice, bridging identity, contact relationships, multi-device presence, messaging, calling, and AI intelligence into a cohesive, high-performance platform.

## 2. Core Architectural Pillars

### 2.1 Single Canonical Identity
- **No Duplicate Identity**: Strictly reuses `User`. All profile extensions (`organizationId`, `department`, `jobTitle`, `timezone`, `locale`) are first-class fields on `User`.
- Zero data fragmentation or synchronization latency.

### 2.2 Relational Contact Graph & Organization Directory
- **Bi-Directional Relationships**: Explicit `ContactRelationship` models with states `PENDING`, `ACCEPTED`, `REJECTED`, `BLOCKED`, `REMOVED`.
- **Custom Groups**: Users can organize contacts into colored, named groups (`ContactGroup` and `ContactGroupMember`) without duplicating user entities.
- **Directory Scoping**: Enterprise users can browse colleagues within their `organizationId` with department and title filters while honoring individual privacy settings (`discoverableBy...`).

### 2.3 Conversation-Linked Calling & Call Intelligence
- **Call-from-Conversation**: Calls can be initiated directly from any 1:1 or group conversation thread with `conversationId`.
- **Call Lifecycle Timeline Events**:
  - Call started: Automatically creates a `CALL_EVENT` message in the conversation thread.
  - Call ended: Calculates duration and emits a `CALL_EVENT` message indicating duration and termination reason.
- **AI Summary Event Integration**: When post-call intelligence completes via `AIIntelligenceService`, it automatically posts an `AI_EVENT` card into the conversation containing overview, key highlights, and sentiment.

### 2.4 Frontend Modularization & Performance
- Decomposed the legacy monolithic `MessagingWorkspace` (1801 lines) into dedicated, high-cohesion feature modules:
  - `SocialWorkspace.tsx`: Master coordinator with responsive layout.
  - `ConversationList.tsx` & `ConversationView.tsx`: Real-time chat threads.
  - `MessageComposer.tsx`: Input with debounced typing indicators and attachments.
  - `MessageItem.tsx`: Rich message bubbles, reactions, voice player, call/AI cards.
  - `ContactList.tsx` & `ContactCard.tsx`: Filterable contact management.
  - `DirectoryView.tsx`: Enterprise directory explorer.
  - `PresenceBadge.tsx`: Color-coded animated presence indicators.
  - `NotificationCenter.tsx`: Real-time alert bell and preference manager.
