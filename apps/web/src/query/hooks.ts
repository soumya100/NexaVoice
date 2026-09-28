/**
 * NexaVoice Typed TanStack Query & Mutation Hooks
 * 
 * Reusable domain hooks that connect components to GraphQL
 * operations through the centralized QueryClient and QueryKey factories.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  executeGraphQL,
  GET_USER_CONVERSATIONS,
  GET_CONVERSATION_MESSAGES,
  GET_CONTACTS,
  SEND_MESSAGE_MUTATION,
  EDIT_MESSAGE_MUTATION,
  DELETE_MESSAGE_MUTATION,
  ADD_REACTION_MUTATION,
  REMOVE_REACTION_MUTATION,
  UPDATE_READ_WATERMARK_MUTATION,
  SEND_CONTACT_REQUEST,
  BLOCK_USER_MUTATION,
  REMOVE_PARTICIPANT_MUTATION,
} from '../services/api';
import { conversationKeys, contactKeys, authKeys, healthKeys } from './query-keys';
import { authService, AuthUser } from '../services/auth';

// -------------------------------------------------------------
// Current User / Auth Queries
// -------------------------------------------------------------

export function useMeQuery() {
  return useQuery({
    queryKey: authKeys.me(),
    queryFn: async (): Promise<AuthUser> => {
      const data = await executeGraphQL<{ me: AuthUser }>(`
        query GetMe {
          me {
            id
            username
            displayName
            nexaVoiceId
            accountState
            roles
          }
        }
      `);
      return data.me;
    },
    enabled: authService.isAuthenticated(),
  });
}

// -------------------------------------------------------------
// Conversation Queries & Mutations
// -------------------------------------------------------------

export interface ConversationParticipant {
  id: string;
  userId: string;
  conversationRole: string;
  isMuted: boolean;
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
    status: string;
  };
}

export interface ConversationItem {
  id: string;
  type: string;
  title?: string;
  description?: string;
  avatarUrl?: string;
  currentSequence: number;
  unreadCount: number;
  lastMessageSnippet?: string;
  lastMessageAt?: string;
  isMuted: boolean;
  participants: ConversationParticipant[];
}

export function useConversationsQuery() {
  return useQuery({
    queryKey: conversationKeys.lists(),
    queryFn: async (): Promise<ConversationItem[]> => {
      const data = await executeGraphQL<{ conversations: ConversationItem[] }>(GET_USER_CONVERSATIONS);
      return data.conversations || [];
    },
    enabled: authService.isAuthenticated(),
  });
}

export interface MessageItem {
  id: string;
  conversationId: string;
  senderId: string;
  clientMessageId?: string;
  sequenceNumber: number;
  content: string;
  type: string;
  deliveryStatus: string;
  isEdited?: boolean;
  replyToMessageId?: string;
  createdAt: string;
  updatedAt?: string;
  sender: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
  };
  reactions?: Array<{ id: string; reaction: string; userId: string; user?: { id: string; displayName: string } }>;
  attachments?: Array<{ id: string; fileName: string; mimeType: string; sizeBytes: number; downloadUrl?: string }>;
}

export function useConversationMessagesQuery(conversationId?: string | null) {
  return useQuery({
    queryKey: conversationKeys.messages(conversationId || ''),
    queryFn: async (): Promise<MessageItem[]> => {
      if (!conversationId) return [];
      const data = await executeGraphQL<{ messages: { edges: Array<{ node: MessageItem }> } }>(
        GET_CONVERSATION_MESSAGES,
        { input: { conversationId, limit: 50 } },
      );
      return (data.messages?.edges || []).map((e) => e.node);
    },
    enabled: Boolean(conversationId) && authService.isAuthenticated(),
  });
}

export function useSendMessageMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: {
      input: {
        conversationId: string;
        content: string;
        clientMessageId?: string;
        attachmentIds?: string[];
      };
    }) => {
      return executeGraphQL<{ sendMessage: MessageItem }>(SEND_MESSAGE_MUTATION, variables);
    },
    onSuccess: (data, variables) => {
      const { conversationId } = variables.input;
      const sentMessage = data.sendMessage;

      // Update message list cache idempotently
      queryClient.setQueryData<MessageItem[]>(
        conversationKeys.messages(conversationId),
        (old = []) => {
          // If message already inserted by realtime socket, don't duplicate
          if (old.some((m) => m.id === sentMessage.id || (m.clientMessageId && m.clientMessageId === sentMessage.clientMessageId))) {
            return old.map((m) =>
              m.id === sentMessage.id || m.clientMessageId === sentMessage.clientMessageId ? sentMessage : m,
            );
          }
          return [...old, sentMessage];
        },
      );

      // Invalidate conversation list so snippets update
      queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
    },
  });
}

export function useEditMessageMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { input: { messageId: string; content: string } }) => {
      return executeGraphQL<{ editMessage: MessageItem }>(EDIT_MESSAGE_MUTATION, variables);
    },
    onSuccess: (_data, _variables) => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.all });
    },
  });
}

export function useDeleteMessageMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { input: { messageId: string } }) => {
      return executeGraphQL<{ deleteMessage: boolean }>(DELETE_MESSAGE_MUTATION, variables);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.all });
    },
  });
}

export function useAddReactionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { input: { messageId: string; reaction: string } }) => {
      return executeGraphQL(ADD_REACTION_MUTATION, variables);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.all });
    },
  });
}

export function useRemoveReactionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { input: { messageId: string; reaction: string } }) => {
      return executeGraphQL(REMOVE_REACTION_MUTATION, variables);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.all });
    },
  });
}

export function useUpdateReadWatermarkMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { input: { conversationId: string; messageId: string } }) => {
      return executeGraphQL(UPDATE_READ_WATERMARK_MUTATION, variables);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
    },
  });
}

// -------------------------------------------------------------
// Contacts Queries & Mutations
// -------------------------------------------------------------

export function useContactsQuery() {
  return useQuery({
    queryKey: contactKeys.list(),
    queryFn: async () => {
      const data = await executeGraphQL<{ contacts: any[] }>(GET_CONTACTS);
      return data.contacts || [];
    },
    enabled: authService.isAuthenticated(),
  });
}

export function useSendContactRequestMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { input: { recipientId: string } }) => {
      return executeGraphQL(SEND_CONTACT_REQUEST, variables);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contactKeys.all });
    },
  });
}

export function useBlockUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { input: { userId: string } }) => {
      return executeGraphQL(BLOCK_USER_MUTATION, variables);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contactKeys.all });
      queryClient.invalidateQueries({ queryKey: conversationKeys.all });
    },
  });
}

export function useRemoveParticipantMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variables: { conversationId: string; userId: string }) => {
      return executeGraphQL(REMOVE_PARTICIPANT_MUTATION, variables);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.detail(variables.conversationId) });
      queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
    },
  });
}

// -------------------------------------------------------------
// System Health Query
// -------------------------------------------------------------

export function useHealthReadyQuery() {
  return useQuery({
    queryKey: healthKeys.ready(),
    queryFn: async () => {
      const res = await fetch('/health/ready');
      if (!res.ok) {
        throw new Error(`Health check returned HTTP ${res.status}`);
      }
      return res.json();
    },
    staleTime: 10 * 1000,
  });
}
