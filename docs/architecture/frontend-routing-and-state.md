# NexaVoice Frontend Routing, Server State & Realtime Architecture

## 1. Executive Summary

This architecture establishes **TanStack Router** and **TanStack Query** as the sole, authoritative routing and server-state foundations for the NexaVoice web frontend. It completely replaces ad-hoc state duplication, eliminates arbitrary query strings, binds Socket.IO realtime events directly into query cache, enforces strict type-safe navigation, and guarantees complete client-side data purging upon logout or session revocation.

---

## 2. High-Level Architecture

```
                          ┌───────────────────────────┐
                          │      TanStack Router      │
                          │   Type-Safe Route Tree    │
                          │   Context & Auth Guards   │
                          └─────────────┬─────────────┘
                                        │
                                        ▼
                                    React UI
                                        │
                         ┌──────────────┴──────────────┐
                         ▼                             ▼
                  TanStack Query                Local React State
                  (Server State)              (UI Ephemeral Only)
                         │
          ┌──────────────┴──────────────┐
          ▼                             ▼
     GraphQL Client              Socket.IO Client
          │                             │
          ▼                             ▼
    NestJS GraphQL API        Targeted Query Invalidation
                                 & Idempotent setQueryData
```

---

## 3. TanStack Router Architecture

### 3.1 Route Hierarchy
```
/                                   [Index Route: auth-aware redirect]
├── auth                            [Auth Layout: redirect if already authenticated]
│   ├── login                       [Login Form, redirect param handling]
│   └── register                    [Account Registration]
│
├── app                             [Protected Route: beforeLoad guard]
│   ├── /                           [Redirect -> /app/conversations]
│   ├── home                        [System Overview & Diagnostics]
│   ├── conversations               [Messaging Workspace]
│   ├── conversations/$conversationId [Direct Active Conversation View]
│   ├── contacts                    [Encrypted Address Book]
│   ├── calls                       [WebRTC Signaling Dashboard]
│   └── settings                    [Security, Sessions, Audit Trail]
│
└── 404                             [NotFoundComponent: Safe fallback]
```

### 3.2 Authentication Route Guards & Open-Redirect Defense
- **Guard Mechanism**: TanStack Router `beforeLoad` checks `context.auth.isAuthenticated()`.
- **UX Boundary Only**: Frontend route guards optimize user navigation. The NestJS backend remains the authoritative security enforcement point.
- **Open-Redirect Protection**: Incoming `?redirect=` search parameters are strictly sanitized via `authService.validateRedirect()`. Only internal relative paths starting with a single `/` (and not `//` or scheme prefixes) are permitted.

### 3.3 Type-Safe Navigation
The router instance registers globally via:
```typescript
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
```
All links (`<Link to="/app/conversations" />`), programmatic transitions (`navigate({ to: '/auth/login' })`), and route parameters (`$conversationId`) are verified at compile-time.

---

## 4. TanStack Query Architecture

### 4.1 Central QueryClient Configuration
```typescript
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,       // Fresh for 30s
      gcTime: 5 * 60 * 1000,      // Inactive cache retained for 5m
      retry(failureCount, error) {
        // Never retry 401, 403, 404, 422 or GraphQL auth errors
        if (isAuthOrClientError(error)) return false;
        return failureCount < 2;  // Retry transient network errors up to 2 times
      },
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      networkMode: 'online',
    },
    mutations: {
      retry: false,               // Never retry mutations automatically
    },
  },
});
```

### 4.2 Query-Key Factories
All server state queries consume centralized, typed query-key factories (`apps/web/src/query/query-keys.ts`):
- `authKeys.me()`: `['auth', 'me']`
- `authKeys.sessions()`: `['auth', 'sessions']`
- `conversationKeys.lists()`: `['conversations', 'list']`
- `conversationKeys.detail(id)`: `['conversations', 'detail', id]`
- `conversationKeys.messages(id, filters)`: `['conversations', 'messages', id, filters]`
- `contactKeys.list()`: `['contacts', 'list']`
- `healthKeys.ready()`: `['health', 'ready']`

---

## 5. GraphQL + TanStack Query Integration

```
React Component
      ↓
useConversationMessagesQuery(conversationId)
      ↓
executeGraphQL<T>(GET_CONVERSATION_MESSAGES, { conversationId })
      ↓
Authorization Header: Bearer <in-memory token>
      ↓
NestJS GraphQL Gateway (/graphql)
```
- **Error Normalization**: `executeGraphQL` intercepts HTTP and GraphQL response payloads. On status `401` or error code `UNAUTHENTICATED`, it immediately invokes `authService.handleSessionExpiry()`.

---

## 6. Socket.IO Realtime & TanStack Query Cache Rules

| Realtime Event | Cache Strategy | Action Detail |
|---|---|---|
| `conversation.message.created` | `setQueryData` | Idempotently appends message to `conversationKeys.messages(convId)` checking both `id` and `clientMessageId`. Updates conversation snippet and unread counter in `conversationKeys.lists()`. |
| `conversation.message.updated` | `setQueryData` | Modifies existing message record in `conversationKeys.messages(convId)`. |
| `conversation.message.deleted` | `setQueryData` | Filters out message from `conversationKeys.messages(convId)`. |
| `conversation.evicted` | `removeQueries` + `invalidateQueries` | Removes `conversationKeys.detail(id)` and `conversationKeys.messages(id)`. Invalidates `conversationKeys.lists()`. |
| `conversation.participant.removed` | `invalidateQueries` | Invalidates `conversationKeys.detail(id)` and `conversationKeys.lists()`. |
| `conversation.typing.started/stopped` | **No Query Cache** | Ephemeral presence notification handled in component state. Never stored in long-lived server-state cache. |

### Mutation + Socket Deduplication
When a client sends a message via GraphQL mutation, the mutation response is inserted into TanStack Query cache. When the server broadcasts `conversation.message.created` via Socket.IO, `realtimeService` compares both `id` and `clientMessageId`:
```typescript
const exists = old.some((m) => m.id === message.id || (m.clientMessageId && m.clientMessageId === message.clientMessageId));
if (exists) {
  return old.map((m) => m.id === message.id || m.clientMessageId === message.clientMessageId ? message : m);
}
return [...old, message];
```
This ensures zero duplicate messages regardless of whether the mutation response or WebSocket broadcast arrives first.

---

## 7. Authentication Lifecycle & Cache Sanitization

```
[Logout / 401 Expiry / Session Revocation]
        │
        ├─► 1. queryClient.cancelQueries()   (Cancel pending HTTP requests)
        ├─► 2. queryClient.clear()           (Wipe all sensitive cached queries)
        ├─► 3. realtimeService.disconnect()  (Close active WebSocket)
        ├─► 4. Clear In-Memory Tokens       (Wipe access & refresh tokens)
        └─► 5. router.navigate('/auth/login')
```
- **Guaranteed Isolation**: Because `queryClient.clear()` runs synchronously, backward navigation cannot expose previously viewed conversations, messages, or contact details.
- **No Sensitive Local Storage**: Private messages, call records, and security logs are never persisted to `localStorage` or `IndexedDB`.

---

## 8. Client vs. Server State Decision Matrix

| State Type | Mechanism | Examples |
|---|---|---|
| **Server State** | **TanStack Query** | Conversations, messages, participant lists, contacts, audit logs, system diagnostics. |
| **Local UI State** | **React `useState` / `useReducer`** | Modal visibility, input composer text, audio/mic mute toggles, dropdown active states. |
| **Ephemeral Realtime**| **Socket.IO Event Listeners** | Typing indicators ("Alice is typing..."), active call ring status. |
| **Global Client Preferences** | **React Context / Theme** | Dark/light theme, audio device selection. |
