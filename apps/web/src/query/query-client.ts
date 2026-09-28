/**
 * NexaVoice Web QueryClient Configuration
 * 
 * Centralized, controlled TanStack Query configuration.
 * Explicitly guards against aggressive retries for auth/mutations,
 * manages caching intervals, and handles secure purge upon logout.
 */

import { QueryClient } from '@tanstack/react-query';
import { authService } from '../services/auth';
import { realtimeService } from '../services/realtime';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data remains fresh for 30 seconds to minimize redundant network requests
      staleTime: 30 * 1000,
      // Unused query data is garbage collected after 5 minutes
      gcTime: 5 * 60 * 1000,
      // Custom retry strategy: NEVER retry auth or client-side errors
      retry(failureCount, error: any) {
        if (
          error?.status === 401 ||
          error?.status === 403 ||
          error?.status === 404 ||
          error?.status === 422 ||
          error?.extensions?.code === 'UNAUTHENTICATED' ||
          error?.extensions?.code === 'FORBIDDEN'
        ) {
          return false;
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      networkMode: 'online',
    },
    mutations: {
      // Mutations must NEVER auto-retry to prevent accidental duplicate actions
      retry: false,
      networkMode: 'online',
    },
  },
});

// Wire realtime Socket.IO synchronization directly to this QueryClient
realtimeService.attachQueryClient(queryClient);

/**
 * Completely purges all cached query data, cancels pending requests,
 * and disconnects active realtime WebSocket connections.
 * Invoked synchronously upon logout, session revocation, or 401 expiry.
 */
export function purgeProtectedQueryData() {
  queryClient.cancelQueries();
  queryClient.clear();
  realtimeService.disconnect();
}

// Register purge hook with authService so any session expiry immediately purges cached data
authService.registerPurgeCallback(purgeProtectedQueryData);
