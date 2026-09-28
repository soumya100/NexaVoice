import { QueryClient } from '@tanstack/react-query';
import { authService } from '../services/auth';

export interface RouterContext {
  queryClient: QueryClient;
  auth: typeof authService;
}
