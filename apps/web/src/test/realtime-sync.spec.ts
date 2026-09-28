import { describe, it, expect, beforeEach, vi } from 'vitest';
import { queryClient } from '../query/query-client';
import { conversationKeys } from '../query/query-keys';
import { RealtimeClient } from '../services/realtime';
import { MessageItem } from '../query/hooks';

describe('Realtime Socket.IO & TanStack Query Cache Sync', () => {
  let realtime: RealtimeClient;
  let mockSocket: any;

  beforeEach(() => {
    queryClient.clear();
    realtime = new RealtimeClient();

    const listeners: Record<string, Function[]> = {};
    mockSocket = {
      connected: true,
      on: vi.fn((event: string, cb: Function) => {
        listeners[event] = listeners[event] || [];
        listeners[event].push(cb);
      }),
      emit: vi.fn(),
      off: vi.fn(),
      disconnect: vi.fn(),
    };

    // Override internal socket connect
    (realtime as any).socket = mockSocket;
    (realtime as any).queryClient = queryClient;
    (realtime as any).registerQuerySyncHandlers();
  });

  const getHandler = (event: string) => {
    const call = mockSocket.on.mock.calls.find((c: any[]) => c[0] === event);
    return call ? call[1] : null;
  };

  it('conversation.message.created idempotently deduplicates messages in query cache', () => {
    const handler = getHandler('conversation.message.created');
    expect(handler).toBeDefined();

    const conversationId = 'conv-123';
    const existingMsg: MessageItem = {
      id: 'msg-1',
      conversationId,
      senderId: 'user-1',
      clientMessageId: 'cli-uuid-1',
      sequenceNumber: 1,
      content: 'Hello World',
      type: 'TEXT',
      deliveryStatus: 'SENT',
      createdAt: new Date().toISOString(),
      sender: { id: 'user-1', username: 'alice', displayName: 'Alice' },
    };

    // 1. Initial state populated by mutation
    queryClient.setQueryData(conversationKeys.messages(conversationId), [existingMsg]);

    // 2. Socket receives the exact same message broadcast
    handler({ message: existingMsg });

    const messages = queryClient.getQueryData<MessageItem[]>(conversationKeys.messages(conversationId));
    expect(messages?.length).toBe(1);
    expect(messages?.[0].id).toBe('msg-1');

    // 3. Socket receives a new message
    const newMsg: MessageItem = {
      id: 'msg-2',
      conversationId,
      senderId: 'user-2',
      clientMessageId: 'cli-uuid-2',
      sequenceNumber: 2,
      content: 'Welcome Alice!',
      type: 'TEXT',
      deliveryStatus: 'DELIVERED',
      createdAt: new Date().toISOString(),
      sender: { id: 'user-2', username: 'bob', displayName: 'Bob' },
    };
    handler({ message: newMsg });

    const updatedMessages = queryClient.getQueryData<MessageItem[]>(conversationKeys.messages(conversationId));
    expect(updatedMessages?.length).toBe(2);
    expect(updatedMessages?.[1].content).toBe('Welcome Alice!');
  });

  it('conversation.message.updated updates existing cached message', () => {
    const handler = getHandler('conversation.message.updated');
    expect(handler).toBeDefined();

    const conversationId = 'conv-123';
    const message: MessageItem = {
      id: 'msg-1',
      conversationId,
      senderId: 'user-1',
      sequenceNumber: 1,
      content: 'Original Content',
      type: 'TEXT',
      deliveryStatus: 'SENT',
      createdAt: new Date().toISOString(),
      sender: { id: 'user-1', username: 'alice', displayName: 'Alice' },
    };
    queryClient.setQueryData(conversationKeys.messages(conversationId), [message]);

    handler({ message: { ...message, content: 'Edited Content', isEdited: true } });

    const messages = queryClient.getQueryData<MessageItem[]>(conversationKeys.messages(conversationId));
    expect(messages?.[0].content).toBe('Edited Content');
    expect(messages?.[0].isEdited).toBe(true);
  });

  it('conversation.message.deleted removes message from query cache', () => {
    const handler = getHandler('conversation.message.deleted');
    expect(handler).toBeDefined();

    const conversationId = 'conv-123';
    const m1 = { id: 'm-1', conversationId, content: 'One' } as any;
    const m2 = { id: 'm-2', conversationId, content: 'Two' } as any;
    queryClient.setQueryData(conversationKeys.messages(conversationId), [m1, m2]);

    handler({ conversationId, messageId: 'm-1' });

    const messages = queryClient.getQueryData<MessageItem[]>(conversationKeys.messages(conversationId));
    expect(messages?.length).toBe(1);
    expect(messages?.[0].id).toBe('m-2');
  });

  it('conversation.evicted removes conversation detail queries and invalidates lists', () => {
    const handler = getHandler('conversation.evicted');
    expect(handler).toBeDefined();

    const conversationId = 'conv-private';
    queryClient.setQueryData(conversationKeys.detail(conversationId), { id: conversationId, title: 'Secret' });
    queryClient.setQueryData(conversationKeys.messages(conversationId), [{ id: 'm-1' }]);

    handler({ conversationId });

    expect(queryClient.getQueryData(conversationKeys.detail(conversationId))).toBeUndefined();
    expect(queryClient.getQueryData(conversationKeys.messages(conversationId))).toBeUndefined();
  });
});
