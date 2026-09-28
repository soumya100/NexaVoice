import { describe, it, expect } from 'vitest';
import {
  authKeys,
  conversationKeys,
  contactKeys,
  healthKeys,
  securityKeys,
} from '../query/query-keys';

describe('Query Key Factories', () => {
  it('creates deterministic auth keys', () => {
    expect(authKeys.all).toEqual(['auth']);
    expect(authKeys.me()).toEqual(['auth', 'me']);
    expect(authKeys.sessions()).toEqual(['auth', 'sessions']);
  });

  it('creates deterministic, parameter-bound conversation keys', () => {
    expect(conversationKeys.all).toEqual(['conversations']);
    expect(conversationKeys.lists()).toEqual(['conversations', 'list']);
    expect(conversationKeys.detail('c-100')).toEqual(['conversations', 'detail', 'c-100']);
    expect(conversationKeys.messages('c-100')).toEqual(['conversations', 'messages', 'c-100', {}]);
    expect(conversationKeys.messages('c-100', { limit: 20 })).toEqual([
      'conversations',
      'messages',
      'c-100',
      { limit: 20 },
    ]);
    expect(conversationKeys.participants('c-100')).toEqual(['conversations', 'participants', 'c-100']);
  });

  it('creates deterministic contact keys', () => {
    expect(contactKeys.all).toEqual(['contacts']);
    expect(contactKeys.list()).toEqual(['contacts', 'list']);
    expect(contactKeys.requests()).toEqual(['contacts', 'requests']);
    expect(contactKeys.blocked()).toEqual(['contacts', 'blocked']);
  });

  it('creates deterministic health and security keys', () => {
    expect(healthKeys.ready()).toEqual(['health', 'ready']);
    expect(securityKeys.auditLogs(50)).toEqual(['security', 'auditLogs', 50]);
  });
});
