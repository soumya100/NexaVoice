import { describe, it, expect, beforeEach, vi } from 'vitest';
import { authService, AuthUser } from '../services/auth';

describe('AuthService & Session Lifecycle', () => {
  beforeEach(() => {
    authService.logout();
    sessionStorage.clear();
    localStorage.clear();
  });

  const mockUser: AuthUser = {
    id: 'usr-100',
    username: 'alice',
    displayName: 'Alice Cooper',
    nexaVoiceId: 'NV-1234-5678',
    roles: ['USER'],
    accountState: 'ACTIVE',
  };

  it('initializes in UNAUTHENTICATED state when no credentials stored', () => {
    expect(authService.isAuthenticated()).toBe(false);
    expect(authService.getUser()).toBeNull();
    expect(authService.getAccessToken()).toBeNull();
  });

  it('sets authenticated session and notifies subscribers', () => {
    const listener = vi.fn();
    const unsubscribe = authService.subscribe(listener);

    authService.setSession(mockUser, 'test-access-token', 'test-refresh-token');

    expect(authService.isAuthenticated()).toBe(true);
    expect(authService.getUser()?.username).toBe('alice');
    expect(authService.getAccessToken()).toBe('test-access-token');
    expect(authService.getRefreshToken()).toBe('test-refresh-token');
    expect(listener).toHaveBeenCalledWith('AUTHENTICATED', mockUser);

    unsubscribe();
  });

  it('sets SUSPENDED or LOCKED status for suspended user accounts', () => {
    const suspendedUser: AuthUser = { ...mockUser, accountState: 'SUSPENDED' };
    authService.setSession(suspendedUser, 'token');
    expect(authService.getStatus()).toBe('SUSPENDED');
    expect(authService.isAuthenticated()).toBe(false);

    const lockedUser: AuthUser = { ...mockUser, accountState: 'LOCKED' };
    authService.setSession(lockedUser, 'token');
    expect(authService.getStatus()).toBe('LOCKED');
    expect(authService.isAuthenticated()).toBe(false);
  });

  it('triggers purge callback and transitions to SESSION_EXPIRED on session expiry', () => {
    const purgeSpy = vi.fn();
    authService.registerPurgeCallback(purgeSpy);
    authService.setSession(mockUser, 'test-token');

    authService.handleSessionExpiry();

    expect(authService.getStatus()).toBe('SESSION_EXPIRED');
    expect(authService.isAuthenticated()).toBe(false);
    expect(authService.getAccessToken()).toBeNull();
    expect(purgeSpy).toHaveBeenCalledTimes(1);
  });

  it('clears all credentials and triggers purge on full logout', () => {
    const purgeSpy = vi.fn();
    authService.registerPurgeCallback(purgeSpy);
    authService.setSession(mockUser, 'test-token');

    authService.logout();

    expect(authService.getStatus()).toBe('UNAUTHENTICATED');
    expect(authService.getUser()).toBeNull();
    expect(authService.getAccessToken()).toBeNull();
    expect(purgeSpy).toHaveBeenCalledTimes(1);
  });

  it('validates redirects and rejects open-redirect vectors', () => {
    // Valid relative internal paths
    expect(authService.validateRedirect('/app/conversations')).toBe('/app/conversations');
    expect(authService.validateRedirect('/app/conversations/conv-123')).toBe('/app/conversations/conv-123');
    expect(authService.validateRedirect('/app/settings')).toBe('/app/settings');

    // Open-redirect attacks blocked
    expect(authService.validateRedirect('https://evil.com')).toBe('/app/conversations');
    expect(authService.validateRedirect('http://attacker.site/phish')).toBe('/app/conversations');
    expect(authService.validateRedirect('//evil.com/fake-login')).toBe('/app/conversations');
    expect(authService.validateRedirect('/\\evil.com')).toBe('/app/conversations');
    expect(authService.validateRedirect('javascript:alert(1)')).toBe('/app/conversations');
    expect(authService.validateRedirect('')).toBe('/app/conversations');
    expect(authService.validateRedirect(undefined)).toBe('/app/conversations');
  });
});
