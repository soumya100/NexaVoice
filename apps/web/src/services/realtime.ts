/**
 * NexaVoice Realtime Socket.IO Client & QueryClient Integration
 * 
 * Manages WebSocket connection to /realtime namespace,
 * handles typing indicators and room presence, and synchronizes
 * realtime events into the TanStack Query cache idempotently.
 */

import { io, Socket } from 'socket.io-client';
import { QueryClient } from '@tanstack/react-query';
import { authService } from './auth';
import { conversationKeys } from '../query/query-keys';
import { MessageItem, ConversationItem } from '../query/hooks';

export type RealtimeConnectionState = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'AUTH_ERROR';

export class RealtimeClient {
  private socket: Socket | null = null;
  private connectionState: RealtimeConnectionState = 'DISCONNECTED';
  private stateListeners: Set<(state: RealtimeConnectionState) => void> = new Set();
  private joinedConversations: Set<string> = new Set();
  private activeConversationId: string | null = null;
  private queryClient?: QueryClient;

  /**
   * Binds the application QueryClient to automatically receive
   * realtime updates and perform targeted cache synchronization.
   */
  public attachQueryClient(qc: QueryClient) {
    this.queryClient = qc;
  }

  public setActiveConversation(conversationId: string | null) {
    this.activeConversationId = conversationId;
  }

  /**
   * Initializes or returns active Socket.IO connection.
   */
  connect(): Socket {
    if (this.socket && this.socket.connected) {
      return this.socket;
    }

    const token = authService.getAccessToken() || '';

    this.connectionState = 'CONNECTING';
    this.notifyState();

    this.socket = io('/realtime', {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      auth: { token },
      query: { token },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.socket.on('connect', () => {
      // Socket connected; waiting for backend authenticated event
    });

    this.socket.on('authenticated', () => {
      this.connectionState = 'CONNECTED';
      this.notifyState();

      // Re-join any active conversation rooms upon reconnection
      for (const convId of this.joinedConversations) {
        this.socket?.emit('join-conversation', { conversationId: convId });
      }
    });

    this.socket.on('auth_error', () => {
      this.connectionState = 'AUTH_ERROR';
      this.notifyState();
      authService.handleSessionExpiry();
    });

    this.socket.on('disconnect', () => {
      this.connectionState = 'DISCONNECTED';
      this.notifyState();
    });

    this.socket.on('connect_error', () => {
      this.connectionState = 'DISCONNECTED';
      this.notifyState();
    });

    // Wire automatic query cache synchronization
    this.registerQuerySyncHandlers();

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.connectionState = 'DISCONNECTED';
    this.notifyState();
  }

  getConnectionState(): RealtimeConnectionState {
    return this.connectionState;
  }

  onStateChange(listener: (state: RealtimeConnectionState) => void): () => void {
    this.stateListeners.add(listener);
    listener(this.connectionState);
    return () => this.stateListeners.delete(listener);
  }

  private notifyState() {
    for (const listener of this.stateListeners) {
      listener(this.connectionState);
    }
  }

  joinConversation(conversationId: string) {
    this.joinedConversations.add(conversationId);
    if (this.socket && this.socket.connected) {
      this.socket.emit('join-conversation', { conversationId });
    }
  }

  leaveConversation(conversationId: string) {
    this.joinedConversations.delete(conversationId);
    if (this.socket && this.socket.connected) {
      this.socket.emit('leave-conversation', { conversationId });
    }
  }

  sendTypingStart(conversationId: string) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('typing-start', { conversationId });
    }
  }

  sendTypingStop(conversationId: string) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('typing-stop', { conversationId });
    }
  }

  // ==========================================
  // Query Cache Synchronization (Rules)
  // ==========================================

  private registerQuerySyncHandlers() {
    if (!this.socket) return;

    // 1. New Message: setQueryData (idempotent deduplication)
    this.socket.on('conversation.message.created', (payload: any) => {
      if (!this.queryClient) return;

      const message: MessageItem = payload.message || payload;
      const conversationId = message.conversationId;

      // Update message list cache
      this.queryClient.setQueryData<MessageItem[]>(
        conversationKeys.messages(conversationId),
        (old = []) => {
          // Deduplicate by message ID and clientMessageId
          const exists = old.some(
            (m) => m.id === message.id || (m.clientMessageId && m.clientMessageId === message.clientMessageId),
          );
          if (exists) {
            return old.map((m) =>
              m.id === message.id || (m.clientMessageId && m.clientMessageId === message.clientMessageId)
                ? message
                : m,
            );
          }
          return [...old, message];
        },
      );

      // Update conversation list snippet and unread counter
      this.queryClient.setQueryData<ConversationItem[]>(
        conversationKeys.lists(),
        (old = []) => {
          return old.map((conv) => {
            if (conv.id === conversationId) {
              const isCurrent = this.activeConversationId === conversationId;
              return {
                ...conv,
                lastMessageSnippet: message.content,
                lastMessageAt: message.createdAt,
                currentSequence: message.sequenceNumber || conv.currentSequence + 1,
                unreadCount: isCurrent ? conv.unreadCount : conv.unreadCount + 1,
              };
            }
            return conv;
          });
        },
      );
    });

    // 2. Message Updated: setQueryData
    this.socket.on('conversation.message.updated', (payload: any) => {
      if (!this.queryClient) return;
      const message: MessageItem = payload.message || payload;

      this.queryClient.setQueryData<MessageItem[]>(
        conversationKeys.messages(message.conversationId),
        (old = []) => old.map((m) => (m.id === message.id ? { ...m, ...message } : m)),
      );
    });

    // 3. Message Deleted: setQueryData
    this.socket.on('conversation.message.deleted', (payload: any) => {
      if (!this.queryClient) return;
      const { conversationId, messageId } = payload;

      this.queryClient.setQueryData<MessageItem[]>(
        conversationKeys.messages(conversationId),
        (old = []) => old.filter((m) => m.id !== messageId),
      );
    });

    // 4. Participant Evicted: removeQueries + invalidateLists
    this.socket.on('conversation.evicted', (payload: any) => {
      if (!this.queryClient) return;
      const { conversationId } = payload;

      this.queryClient.removeQueries({ queryKey: conversationKeys.detail(conversationId) });
      this.queryClient.removeQueries({ queryKey: conversationKeys.messages(conversationId) });
      this.queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
    });

    // 5. Participant Removed from Room: invalidateQueries detail
    this.socket.on('conversation.participant.removed', (payload: any) => {
      if (!this.queryClient) return;
      const { conversationId } = payload;
      this.queryClient.invalidateQueries({ queryKey: conversationKeys.detail(conversationId) });
      this.queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
    });
  }

  // ==========================================
  // Ephemeral & Event Subscriptions
  // ==========================================

  onMessageCreated(callback: (payload: any) => void): () => void {
    const socket = this.connect();
    socket.on('conversation.message.created', callback);
    return () => socket.off('conversation.message.created', callback);
  }

  onMessageUpdated(callback: (payload: any) => void): () => void {
    const socket = this.connect();
    socket.on('conversation.message.updated', callback);
    return () => socket.off('conversation.message.updated', callback);
  }

  onMessageDeleted(callback: (payload: any) => void): () => void {
    const socket = this.connect();
    socket.on('conversation.message.deleted', callback);
    return () => socket.off('conversation.message.deleted', callback);
  }

  onReactionAdded(callback: (payload: any) => void): () => void {
    const socket = this.connect();
    socket.on('conversation.reaction.added', callback);
    return () => socket.off('conversation.reaction.added', callback);
  }

  onReactionRemoved(callback: (payload: any) => void): () => void {
    const socket = this.connect();
    socket.on('conversation.reaction.removed', callback);
    return () => socket.off('conversation.reaction.removed', callback);
  }

  onReadWatermark(callback: (payload: any) => void): () => void {
    const socket = this.connect();
    socket.on('conversation.read.watermark', callback);
    return () => socket.off('conversation.read.watermark', callback);
  }

  onTypingStarted(callback: (payload: { conversationId: string; userId: string; timestamp: string }) => void): () => void {
    const socket = this.connect();
    socket.on('conversation.typing.started', callback);
    return () => socket.off('conversation.typing.started', callback);
  }

  onTypingStopped(callback: (payload: { conversationId: string; userId: string }) => void): () => void {
    const socket = this.connect();
    socket.on('conversation.typing.stopped', callback);
    return () => socket.off('conversation.typing.stopped', callback);
  }

  onEvicted(callback: (payload: { conversationId: string; reason?: string }) => void): () => void {
    const socket = this.connect();
    socket.on('conversation.evicted', callback);
    return () => socket.off('conversation.evicted', callback);
  }
}

export const realtimeService = new RealtimeClient();
export const realtimeClient = realtimeService;
