# NexaVoice API — Contacts & Messaging Reference

## 1. GraphQL Operations Catalog

### 1.1 Queries

#### `conversations`
Retrieves all active direct and group conversations for the authenticated user, ordered by `lastMessageAt DESC`.
```graphql
query GetMyConversations {
  conversations {
    id
    type
    title
    unreadCount
    lastMessageAt
    lastMessageSnippet
    currentSequence
    participants {
      id
      userId
      conversationRole
      isMuted
      user {
        id
        username
        displayName
        nexaVoiceId
        avatarUrl
      }
    }
  }
}
```

#### `messages(input: MessagesPaginationInput!)`
Retrieves cursor-paginated messages for a conversation.
```graphql
query GetMessages($conversationId: ID!, $cursor: String, $limit: Int) {
  messages(input: {
    conversationId: $conversationId,
    cursor: $cursor,
    direction: "before",
    limit: $limit
  }) {
    totalCount
    pageInfo {
      hasNextPage
      hasPreviousPage
      startCursor
      endCursor
    }
    edges {
      cursor
      node {
        id
        sequenceNumber
        content
        type
        deliveryStatus
        isEdited
        sender {
          id
          displayName
          username
        }
        reactions {
          reaction
          user { id displayName }
        }
        attachments {
          id
          fileName
          mimeType
          downloadUrl
          voiceDurationMs
        }
        createdAt
      }
    }
  }
}
```

#### `contacts` & `contactRequests`
```graphql
query GetContactsAndRequests {
  contacts {
    id
    status
    contact {
      id
      username
      displayName
      nexaVoiceId
    }
  }
  contactRequests(filter: "incoming") {
    id
    requester {
      id
      username
      displayName
    }
  }
}
```

---

### 1.2 Mutations

#### `sendMessage(input: SendMessageInput!)`
Dispatches a message with client-side idempotency.
```graphql
mutation SendMessage($input: SendMessageInput!) {
  sendMessage(input: $input) {
    id
    sequenceNumber
    clientMessageId
    content
    deliveryStatus
    createdAt
  }
}

# Variables
{
  "input": {
    "conversationId": "conv-uuid",
    "clientMessageId": "cli-msg-random-uuid",
    "type": "TEXT",
    "content": "Hello from NexaVoice client!"
  }
}
```

#### `addReaction` & `removeReaction`
```graphql
mutation ReactToMessage($messageId: ID!, $reaction: String!) {
  addReaction(messageId: $messageId, reaction: $reaction) {
    id
    reactions {
      reaction
      userId
    }
  }
}
```

#### `markConversationRead`
```graphql
mutation AdvanceReadCursor($conversationId: ID!, $lastMessageId: String) {
  markConversationRead(conversationId: $conversationId, lastMessageId: $lastMessageId)
}
```

#### `createDirectConversation` & `createGroupConversation`
```graphql
mutation StartDirectChat($targetUserId: String!) {
  createDirectConversation(input: { targetUserId: $targetUserId }) {
    id
    type
    title
  }
}
```
