import { authService } from './auth';

export interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string; extensions?: Record<string, unknown> }>;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public extensions?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function getAuthToken(): string {
  return authService.getAccessToken() || localStorage.getItem('nexavoice_access_token') || '';
}

export function setAuthToken(token: string) {
  localStorage.setItem('nexavoice_access_token', token);
}

export async function executeGraphQL<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch('/graphql', {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    });
  } catch (err: any) {
    throw new ApiError(`Network request failed: ${err.message || 'Check network connection'}`);
  }

  if (res.status === 401) {
    authService.handleSessionExpiry();
    throw new ApiError('Session expired or unauthenticated', 401);
  }

  if (!res.ok) {
    throw new ApiError(`GraphQL request failed with HTTP ${res.status}: ${res.statusText}`, res.status);
  }

  const json: GraphQLResponse<T> = await res.json();
  if (json.errors && json.errors.length > 0) {
    const primaryError = json.errors[0];
    const code = primaryError.extensions?.code;

    if (code === 'UNAUTHENTICATED') {
      authService.handleSessionExpiry();
    }

    throw new ApiError(
      primaryError.message || 'GraphQL operation failed',
      code === 'UNAUTHENTICATED' ? 401 : code === 'FORBIDDEN' ? 403 : 400,
      primaryError.extensions,
    );
  }

  return json.data as T;
}

// ==========================================
// GraphQL Operations
// ==========================================

export const GET_USER_CONVERSATIONS = `
  query GetConversations {
    conversations {
      id
      type
      title
      description
      avatarUrl
      currentSequence
      unreadCount
      lastMessageSnippet
      lastMessageAt
      isMuted
      createdAt
      updatedAt
      participants {
        id
        userId
        conversationRole
        isMuted
        user {
          id
          username
          displayName
          avatarUrl
          isOnline
        }
      }
    }
  }
`;

export const CREATE_DIRECT_CONVERSATION = `
  mutation CreateDirectConversation($input: CreateDirectConversationInput!) {
    createDirectConversation(input: $input) {
      id
      type
      title
      description
      avatarUrl
      currentSequence
      unreadCount
      lastMessageSnippet
      lastMessageAt
      isMuted
      createdAt
      updatedAt
      participants {
        id
        userId
        conversationRole
        isMuted
        user {
          id
          username
          displayName
          avatarUrl
          isOnline
        }
      }
    }
  }
`;

export const CREATE_GROUP_CONVERSATION = `
  mutation CreateGroupConversation($input: CreateGroupConversationInput!) {
    createGroupConversation(input: $input) {
      id
      type
      title
      description
      avatarUrl
      currentSequence
      unreadCount
      lastMessageSnippet
      lastMessageAt
      isMuted
      participants {
        id
        userId
        conversationRole
        isMuted
        user {
          id
          username
          displayName
          avatarUrl
          isOnline
        }
      }
    }
  }
`;

export const GET_CONVERSATION_MESSAGES = `
  query GetMessages($input: MessagesPaginationInput!) {
    messages(input: $input) {
      edges {
        cursor
        node {
          id
          conversationId
          senderId
          clientMessageId
          sequenceNumber
          content
          type
          deliveryStatus
          isEdited
          replyToMessageId
          createdAt
          updatedAt
          deletedAt
          sender {
            id
            username
            displayName
            avatarUrl
          }
          reactions {
            id
            reaction
            userId
            user {
              id
              displayName
            }
          }
          attachments {
            id
            fileName
            mimeType
            sizeBytes
            downloadUrl
            voiceDurationMs
          }
        }
      }
      totalCount
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
    }
  }
`;

export const SEND_MESSAGE_MUTATION = `
  mutation SendMessage($input: SendMessageInput!) {
    sendMessage(input: $input) {
      id
      conversationId
      senderId
      clientMessageId
      sequenceNumber
      content
      type
      deliveryStatus
      isEdited
      replyToMessageId
      createdAt
      updatedAt
      sender {
        id
        username
        displayName
        avatarUrl
      }
      reactions {
        id
        reaction
        userId
      }
      attachments {
        id
        fileName
        mimeType
        sizeBytes
        downloadUrl
      }
    }
  }
`;

export const EDIT_MESSAGE_MUTATION = `
  mutation EditMessage($input: EditMessageInput!) {
    editMessage(input: $input) {
      id
      content
      isEdited
      editedAt
      updatedAt
    }
  }
`;

export const DELETE_MESSAGE_MUTATION = `
  mutation DeleteMessage($messageId: String!) {
    deleteMessage(messageId: $messageId)
  }
`;

export const ADD_REACTION_MUTATION = `
  mutation AddReaction($messageId: String!, $reaction: String!) {
    addReaction(messageId: $messageId, reaction: $reaction) {
      id
      reactions {
        id
        reaction
        userId
        user {
          id
          displayName
        }
      }
    }
  }
`;

export const REMOVE_REACTION_MUTATION = `
  mutation RemoveReaction($messageId: String!, $reaction: String!) {
    removeReaction(messageId: $messageId, reaction: $reaction) {
      id
      reactions {
        id
        reaction
        userId
        user {
          id
          displayName
        }
      }
    }
  }
`;

export const UPDATE_READ_WATERMARK_MUTATION = `
  mutation MarkConversationRead($conversationId: String!, $lastMessageId: String) {
    markConversationRead(conversationId: $conversationId, lastMessageId: $lastMessageId)
  }
`;

export const GET_CONTACTS = `
  query GetContacts {
    contacts {
      id
      status
      requesterId
      recipientId
      contact {
        id
        nexaVoiceId
        username
        displayName
        avatarUrl
        isOnline
      }
    }
  }
`;

export const DISCOVER_USERS = `
  query DiscoverUsers($query: String!) {
    discoverUsers(query: $query) {
      id
      nexaVoiceId
      username
      displayName
      avatarUrl
      relationshipStatus
      isBlocked
    }
  }
`;

export const SEND_CONTACT_REQUEST = `
  mutation SendContactRequest($input: SendContactRequestInput!) {
    sendContactRequest(input: $input) {
      id
      status
      contact {
        id
        nexaVoiceId
        username
        displayName
      }
    }
  }
`;

export const BLOCK_USER_MUTATION = `
  mutation BlockUser($userId: String!, $reason: String) {
    blockUser(userId: $userId, reason: $reason)
  }
`;

export const GET_PRIVACY_SETTINGS = `
  query MyPrivacySettings {
    myPrivacySettings {
      id
      discoverableByUsername
      discoverableByNexaVoiceId
      discoverableByEmail
      discoverableByPhone
      whoCanMessageMe
      whoCanAddMeToGroups
      readReceiptsEnabled
      typingIndicatorsEnabled
    }
  }
`;

export const UPDATE_PRIVACY_SETTINGS = `
  mutation UpdatePrivacySettings($input: UpdatePrivacySettingsInput!) {
    updatePrivacySettings(input: $input) {
      id
      discoverableByUsername
      discoverableByNexaVoiceId
      discoverableByEmail
      discoverableByPhone
      whoCanMessageMe
      whoCanAddMeToGroups
      readReceiptsEnabled
      typingIndicatorsEnabled
    }
  }
`;

export const REMOVE_PARTICIPANT_MUTATION = `
  mutation RemoveParticipant($input: RemoveParticipantInput!) {
    removeConversationParticipant(input: $input)
  }
`;

export const SEARCH_MESSAGES_QUERY = `
  query SearchMessages($query: String!, $conversationId: String) {
    searchMessages(query: $query, conversationId: $conversationId) {
      id
      conversationId
      content
      sequenceNumber
      createdAt
      sender {
        id
        displayName
      }
    }
  }
`;

/**
 * Uploads an attachment to the local/S3 storage endpoint using the direct HTTP PUT controller.
 */
export async function uploadAttachmentFile(
  file: File,
  _uploaderId?: string,
): Promise<{ attachmentId: string; fileName: string; mimeType: string; sizeBytes: number }> {
  // 1. Initialize upload via GraphQL
  const initMutation = `
    mutation InitUpload($input: UploadAttachmentInitInput!) {
      initializeAttachmentUpload(input: $input) {
        attachmentId
        uploadUrl
        objectKey
      }
    }
  `;
  const initRes = await executeGraphQL<{
    initializeAttachmentUpload: { attachmentId: string; uploadUrl: string; objectKey: string };
  }>(initMutation, {
    input: {
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
    },
  });

  const { attachmentId, uploadUrl } = initRes.initializeAttachmentUpload;

  // 2. Direct HTTP upload
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
    },
    body: file,
  });

  if (!uploadResponse.ok) {
    const errorJson = await uploadResponse.json().catch(() => ({}));
    throw new Error(errorJson.error || `Upload failed with status ${uploadResponse.status}`);
  }

  return {
    attachmentId,
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
  };
}

// ==========================================
// MILESTONE 8: PRESENCE, NOTIFICATIONS & GROUPS
// ==========================================

export const GET_MY_PRESENCE_QUERY = `
  query GetMyPresence {
    myPresence {
      userId
      status
      customStatus
      availability
      lastSeenAt
    }
  }
`;

export const GET_USER_PRESENCE_QUERY = `
  query GetUserPresence($userId: String!) {
    userPresence(userId: $userId) {
      userId
      status
      customStatus
      availability
      lastSeenAt
    }
  }
`;

export const UPDATE_PRESENCE_MUTATION = `
  mutation UpdatePresence($input: UpdatePresenceInput!) {
    updatePresence(input: $input) {
      userId
      status
      customStatus
      availability
      lastSeenAt
    }
  }
`;

export const GET_NOTIFICATIONS_QUERY = `
  query GetNotifications($limit: Int, $offset: Int, $unreadOnly: Boolean) {
    notifications(limit: $limit, offset: $offset, unreadOnly: $unreadOnly) {
      totalCount
      unreadCount
      items {
        id
        userId
        actorId
        actor {
          id
          displayName
          username
          avatarUrl
        }
        type
        title
        body
        priority
        dataJson
        isRead
        readAt
        createdAt
      }
    }
  }
`;

export const GET_UNREAD_NOTIFICATION_COUNT_QUERY = `
  query GetUnreadNotificationCount {
    unreadNotificationCount
  }
`;

export const MARK_NOTIFICATION_READ_MUTATION = `
  mutation MarkNotificationRead($id: ID!) {
    markNotificationAsRead(id: $id) {
      id
      isRead
      readAt
    }
  }
`;

export const MARK_ALL_NOTIFICATIONS_READ_MUTATION = `
  mutation MarkAllNotificationsRead {
    markAllNotificationsAsRead
  }
`;

export const GET_NOTIFICATION_PREFERENCES_QUERY = `
  query GetNotificationPreferences {
    notificationPreferences {
      id
      userId
      messagesInApp
      messagesEmail
      callsInApp
      callsEmail
      contactRequestsInApp
      contactRequestsEmail
      mentionsInApp
      mentionsEmail
      aiSummariesInApp
      aiSummariesEmail
      globalMute
      muteUntil
    }
  }
`;

export const UPDATE_NOTIFICATION_PREFERENCES_MUTATION = `
  mutation UpdateNotificationPreferences($input: UpdateNotificationPreferenceInput!) {
    updateNotificationPreferences(input: $input) {
      id
      userId
      messagesInApp
      messagesEmail
      callsInApp
      callsEmail
      contactRequestsInApp
      contactRequestsEmail
      mentionsInApp
      mentionsEmail
      aiSummariesInApp
      aiSummariesEmail
      globalMute
      muteUntil
    }
  }
`;

export const GET_CONTACT_GROUPS_QUERY = `
  query GetContactGroups {
    contactGroups {
      id
      userId
      name
      color
      createdAt
      members {
        id
        groupId
        contactUserId
        addedAt
        contactUser {
          id
          nexaVoiceId
          username
          displayName
          avatarUrl
          isOnline
        }
      }
    }
  }
`;

export const CREATE_CONTACT_GROUP_MUTATION = `
  mutation CreateContactGroup($input: CreateContactGroupInput!) {
    createContactGroup(input: $input) {
      id
      userId
      name
      color
    }
  }
`;

export const GET_ORGANIZATION_DIRECTORY_QUERY = `
  query GetOrganizationDirectory($input: OrganizationDirectoryInput) {
    organizationDirectory(input: $input) {
      id
      nexaVoiceId
      username
      displayName
      avatarUrl
      department
      jobTitle
      organizationId
      presenceStatus
      availability
    }
  }
`;

export const TOGGLE_FAVORITE_CONTACT_MUTATION = `
  mutation ToggleFavoriteContact($contactUserId: String!, $isFavorite: Boolean!) {
    toggleFavoriteContact(contactUserId: $contactUserId, isFavorite: $isFavorite)
  }
`;

