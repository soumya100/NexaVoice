/**
 * NexaVoice Web Authentication & Session Service
 * 
 * Authoritative client-side session lifecycle manager.
 * Manages tokens in memory, evaluates session states, triggers
 * query-cache purge upon logout or session revocation, and guards
 * against open-redirect vulnerabilities.
 */

export type AuthStatus =
  | 'INITIALIZING'
  | 'AUTHENTICATED'
  | 'UNAUTHENTICATED'
  | 'SESSION_EXPIRED'
  | 'LOCKED'
  | 'SUSPENDED';

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  nexaVoiceId: string;
  email?: string;
  roles: string[];
  accountState: string;
}

export type AuthListener = (status: AuthStatus, user: AuthUser | null) => void;

class AuthService {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private currentUser: AuthUser | null = null;
  private status: AuthStatus = 'INITIALIZING';
  private listeners = new Set<AuthListener>();
  private onPurgeCallback?: () => void;

  constructor() {
    this.restoreSession();
  }

  /**
   * Registers a cleanup callback (e.g. QueryClient cache clearing)
   * executed whenever session terminates.
   */
  public registerPurgeCallback(callback: () => void) {
    this.onPurgeCallback = callback;
  }

  public subscribe(listener: AuthListener): () => void {
    this.listeners.add(listener);
    listener(this.status, this.currentUser);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.status, this.currentUser);
    }
  }

  public getStatus(): AuthStatus {
    return this.status;
  }

  public getUser(): AuthUser | null {
    return this.currentUser;
  }

  public getAccessToken(): string | null {
    return this.accessToken;
  }

  public getRefreshToken(): string | null {
    return this.refreshToken;
  }

  public isAuthenticated(): boolean {
    return this.status === 'AUTHENTICATED' && !!this.accessToken;
  }

  /**
   * Sets authenticated session credentials.
   */
  public setSession(user: AuthUser, accessToken: string, refreshToken?: string) {
    this.currentUser = user;
    this.accessToken = accessToken;
    if (refreshToken) {
      this.refreshToken = refreshToken;
      sessionStorage.setItem('nv_rt_session', refreshToken);
    }

    if (user.accountState === 'SUSPENDED') {
      this.status = 'SUSPENDED';
    } else if (user.accountState === 'LOCKED') {
      this.status = 'LOCKED';
    } else {
      this.status = 'AUTHENTICATED';
    }

    // Retain minimal session hint for page refresh without storing private messages
    sessionStorage.setItem('nv_user_hint', JSON.stringify({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      nexaVoiceId: user.nexaVoiceId,
      roles: user.roles,
      accountState: user.accountState,
    }));
    sessionStorage.setItem('nv_at_session', accessToken);

    this.notify();
  }

  /**
   * Centralized session expiry handler triggered by 401s or token expiry.
   */
  public handleSessionExpiry() {
    if (this.status === 'UNAUTHENTICATED' || this.status === 'SESSION_EXPIRED') {
      return;
    }

    this.status = 'SESSION_EXPIRED';
    this.accessToken = null;
    this.refreshToken = null;
    this.currentUser = null;

    sessionStorage.removeItem('nv_at_session');
    sessionStorage.removeItem('nv_rt_session');
    sessionStorage.removeItem('nv_user_hint');

    // Purge cached query data immediately
    if (this.onPurgeCallback) {
      this.onPurgeCallback();
    }

    this.notify();
  }

  /**
   * Full user logout with comprehensive client-side resource destruction.
   */
  public logout() {
    this.status = 'UNAUTHENTICATED';
    this.accessToken = null;
    this.refreshToken = null;
    this.currentUser = null;

    sessionStorage.removeItem('nv_at_session');
    sessionStorage.removeItem('nv_rt_session');
    sessionStorage.removeItem('nv_user_hint');
    localStorage.removeItem('nexavoice_access_token');

    // Purge cached query data immediately
    if (this.onPurgeCallback) {
      this.onPurgeCallback();
    }

    this.notify();
  }

  /**
   * Attempts to restore active session from in-memory session storage.
   */
  private restoreSession() {
    try {
      const storedToken = sessionStorage.getItem('nv_at_session') || localStorage.getItem('nexavoice_access_token');
      const storedUser = sessionStorage.getItem('nv_user_hint');

      if (storedToken && storedUser) {
        this.accessToken = storedToken;
        this.currentUser = JSON.parse(storedUser);
        this.status = 'AUTHENTICATED';
      } else {
        // Fallback for initial demo environment if none set
        this.status = 'UNAUTHENTICATED';
      }
    } catch {
      this.status = 'UNAUTHENTICATED';
    }
  }

  /**
   * Validates target redirect URLs to prevent open-redirect vulnerabilities.
   * Only permits internal relative paths starting with a single '/' and not '//'.
   */
  public validateRedirect(target?: string | null): string {
    if (!target) return '/app/conversations';
    const trimmed = target.trim();
    if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.includes('\\') && !trimmed.includes(':')) {
      return trimmed;
    }
    return '/app/conversations';
  }
}

export const authService = new AuthService();
