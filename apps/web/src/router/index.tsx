/**
 * NexaVoice Router Instantiation & Module Registration
 * 
 * Provides type-safe routing across the entire frontend application.
 */

import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routes';
import { queryClient } from '../query/query-client';
import { authService } from '../services/auth';

export const router = createRouter({
  routeTree,
  context: {
    queryClient,
    auth: authService,
  },
  defaultPreload: 'intent',
});

// Register the router instance for type-safety across links, navigation, and params
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
