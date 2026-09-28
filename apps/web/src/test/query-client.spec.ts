import { describe, it, expect, vi } from 'vitest';
import { queryClient, purgeProtectedQueryData } from '../query/query-client';
import { conversationKeys } from '../query/query-keys';
import { realtimeService } from '../services/realtime';

describe('QueryClient Configuration & Purge Policy', () => {
  it('configures custom query defaults for NexaVoice', () => {
    const defaultOptions = queryClient.getDefaultOptions();

    // Freshness and garbage collection
    expect(defaultOptions.queries?.staleTime).toBe(30 * 1000);
    expect(defaultOptions.queries?.gcTime).toBe(5 * 60 * 1000);
    expect(defaultOptions.queries?.refetchOnWindowFocus).toBe(false);

    // Mutations must never auto-retry
    expect(defaultOptions.mutations?.retry).toBe(false);
  });

  it('rejects retries for 401, 403, 404, 422 and UNAUTHENTICATED errors', () => {
    const retryFn = queryClient.getDefaultOptions().queries?.retry as (
      failureCount: number,
      error: any,
    ) => boolean;

    expect(typeof retryFn).toBe('function');

    // Auth errors must NOT retry
    expect(retryFn(0, { status: 401 })).toBe(false);
    expect(retryFn(0, { status: 403 })).toBe(false);
    expect(retryFn(0, { status: 404 })).toBe(false);
    expect(retryFn(0, { status: 422 })).toBe(false);
    expect(retryFn(0, { extensions: { code: 'UNAUTHENTICATED' } })).toBe(false);
    expect(retryFn(0, { extensions: { code: 'FORBIDDEN' } })).toBe(false);

    // Network / transient errors retry up to 2 times
    expect(retryFn(0, new Error('ECONNRESET'))).toBe(true);
    expect(retryFn(1, new Error('ECONNRESET'))).toBe(true);
    expect(retryFn(2, new Error('ECONNRESET'))).toBe(false);
  });

  it('purgeProtectedQueryData clears query cache, cancels in-flight queries and disconnects socket', () => {
    const disconnectSpy = vi.spyOn(realtimeService, 'disconnect');

    // Populate some dummy query data
    queryClient.setQueryData(conversationKeys.lists(), [{ id: 'conv-1', title: 'Secret Room' }]);
    expect(queryClient.getQueryData(conversationKeys.lists())).toBeDefined();

    purgeProtectedQueryData();

    // Cache must be cleared completely
    expect(queryClient.getQueryData(conversationKeys.lists())).toBeUndefined();
    expect(disconnectSpy).toHaveBeenCalledTimes(1);

    disconnectSpy.mockRestore();
  });
});
