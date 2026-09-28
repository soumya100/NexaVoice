import { describe, it, expect, beforeEach } from 'vitest';
import { authService, AuthUser } from '../services/auth';
import { appLayoutRoute, authLayoutRoute, indexRoute } from '../router/routes';

describe('TanStack Router Route Guards & Open-Redirect Defense', () => {
  beforeEach(() => {
    authService.logout();
  });

  const mockUser: AuthUser = {
    id: 'u-1',
    username: 'bob',
    displayName: 'Bob Dylan',
    nexaVoiceId: 'NV-9999-0000',
    roles: ['USER'],
    accountState: 'ACTIVE',
  };

  it('protected route beforeLoad redirects unauthenticated users to login with validated redirect param', () => {
    const beforeLoad = (appLayoutRoute.options as any).beforeLoad;
    expect(beforeLoad).toBeDefined();

    try {
      beforeLoad({
        context: { auth: authService, queryClient: {} },
        location: { href: '/app/conversations/conv-456' },
      });
      expect.unreachable('Should have thrown redirect');
    } catch (err: any) {
      expect(err.options.to).toBe('/auth/login');
      expect(err.options.search).toEqual({ redirect: '/app/conversations/conv-456' });
    }
  });

  it('protected route allows navigation when user is authenticated', () => {
    authService.setSession(mockUser, 'valid-token');
    const beforeLoad = (appLayoutRoute.options as any).beforeLoad;

    expect(() =>
      beforeLoad({
        context: { auth: authService, queryClient: {} },
        location: { href: '/app/conversations' },
      }),
    ).not.toThrow();
  });

  it('auth route beforeLoad redirects authenticated users to /app/conversations', () => {
    authService.setSession(mockUser, 'valid-token');
    const beforeLoad = (authLayoutRoute.options as any).beforeLoad;

    try {
      beforeLoad({
        context: { auth: authService, queryClient: {} },
        location: { href: '/auth/login' },
      });
      expect.unreachable('Should have thrown redirect');
    } catch (err: any) {
      expect(err.options.to).toBe('/app/conversations');
    }
  });

  it('index route redirects unauthenticated to login, authenticated to conversations', () => {
    const beforeLoad = (indexRoute.options as any).beforeLoad;

    // Unauthenticated
    try {
      beforeLoad({ context: { auth: authService, queryClient: {} } });
      expect.unreachable('Should have thrown redirect');
    } catch (err: any) {
      expect(err.options.to).toBe('/auth/login');
    }

    // Authenticated
    authService.setSession(mockUser, 'valid-token');
    try {
      beforeLoad({ context: { auth: authService, queryClient: {} } });
      expect.unreachable('Should have thrown redirect');
    } catch (err: any) {
      expect(err.options.to).toBe('/app/conversations');
    }
  });

  it('sanitizes external redirect URLs to block open redirects', () => {
    const safe1 = authService.validateRedirect('https://malicious.org/steal-creds');
    expect(safe1).toBe('/app/conversations');

    const safe2 = authService.validateRedirect('//phishing.net');
    expect(safe2).toBe('/app/conversations');

    const safe3 = authService.validateRedirect('/app/settings');
    expect(safe3).toBe('/app/settings');
  });
});
