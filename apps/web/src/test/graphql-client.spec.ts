import { describe, it, expect, beforeEach, vi } from 'vitest';
import { executeGraphQL, ApiError } from '../services/api';
import { authService } from '../services/auth';

describe('GraphQL Client & Error Normalization', () => {
  beforeEach(() => {
    authService.logout();
    vi.restoreAllMocks();
  });

  it('injects Bearer authorization token when authenticated', async () => {
    authService.setSession(
      {
        id: 'u-1',
        username: 'alice',
        displayName: 'Alice',
        nexaVoiceId: 'NV-1234-5678',
        roles: ['USER'],
        accountState: 'ACTIVE',
      },
      'mock-bearer-token-123',
    );

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { userConversations: [] } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await executeGraphQL<{ userConversations: any[] }>('query { userConversations { id } }');

    expect(result.userConversations).toEqual([]);
    expect(fetchSpy).toHaveBeenCalledWith(
      '/graphql',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer mock-bearer-token-123',
        }),
      }),
    );
  });

  it('triggers session expiry on HTTP 401 response and throws ApiError', async () => {
    authService.setSession(
      {
        id: 'u-1',
        username: 'alice',
        displayName: 'Alice',
        nexaVoiceId: 'NV-1234-5678',
        roles: ['USER'],
        accountState: 'ACTIVE',
      },
      'expired-token',
    );

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ errors: [{ message: 'Unauthorized' }] }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(executeGraphQL('query { me { id } }')).rejects.toThrow(ApiError);
    expect(authService.isAuthenticated()).toBe(false);
    expect(authService.getStatus()).toBe('SESSION_EXPIRED');
  });

  it('triggers session expiry when GraphQL error extensions has UNAUTHENTICATED', async () => {
    authService.setSession(
      {
        id: 'u-1',
        username: 'alice',
        displayName: 'Alice',
        nexaVoiceId: 'NV-1234-5678',
        roles: ['USER'],
        accountState: 'ACTIVE',
      },
      'revoked-token',
    );

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          errors: [
            {
              message: 'Token revoked or invalid',
              extensions: { code: 'UNAUTHENTICATED' },
            },
          ],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await expect(executeGraphQL('query { me { id } }')).rejects.toThrow(ApiError);
    expect(authService.isAuthenticated()).toBe(false);
    expect(authService.getStatus()).toBe('SESSION_EXPIRED');
  });

  it('throws ApiError with status 403 on FORBIDDEN permission denial without logging out', async () => {
    authService.setSession(
      {
        id: 'u-1',
        username: 'alice',
        displayName: 'Alice',
        nexaVoiceId: 'NV-1234-5678',
        roles: ['USER'],
        accountState: 'ACTIVE',
      },
      'valid-user-token',
    );

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          errors: [
            {
              message: 'Forbidden: Insufficient privileges to view security logs',
              extensions: { code: 'FORBIDDEN' },
            },
          ],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    try {
      await executeGraphQL('query { securityAuditLogs { id } }');
      expect.unreachable('Should have thrown ApiError');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.status).toBe(403);
      // User must remain authenticated when 403 occurs
      expect(authService.isAuthenticated()).toBe(true);
    }
  });
});
