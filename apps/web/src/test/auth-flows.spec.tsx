import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { authApi } from '../features/auth/services/auth-api';
import { authService } from '../services/auth';
import { toastService } from '../services/toast';
import { LoginForm } from '../features/auth/components/LoginForm';
import { SignupForm } from '../features/auth/components/SignupForm';
import { ForgotPasswordForm } from '../features/auth/components/ForgotPasswordForm';
import { ResetPasswordForm } from '../features/auth/components/ResetPasswordForm';
import { PasswordStrengthMeter } from '../features/auth/components/PasswordStrengthMeter';
import { AuthLayout } from '../features/auth/components/AuthLayout';

// Mock TanStack Router
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
  useSearch: () => ({ redirect: undefined, token: undefined }),
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function renderWithClient(ui: React.ReactElement) {
  const queryClient = createTestQueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('Authentication Flows, Forms & Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authService.logout();
    sessionStorage.clear();
    localStorage.clear();
  });

  // ==========================================
  // 1. LOGIN FLOW
  // ==========================================
  describe('LoginForm', () => {
    it('validates required fields on blur or submit and prevents empty submission', async () => {
      renderWithClient(<LoginForm />);

      const submitButton = screen.getByRole('button', { name: /sign in/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(/please enter your username, email, or nexavoice id/i),
        ).toBeInTheDocument();
        expect(screen.getByText(/please enter your password/i)).toBeInTheDocument();
      });
    });

    it('toggles password visibility between password and text', () => {
      renderWithClient(<LoginForm />);

      const passwordInput = screen.getByPlaceholderText('••••••••') as HTMLInputElement;
      expect(passwordInput.type).toBe('password');

      const toggleButton = screen.getByRole('button', { name: /show password/i });
      fireEvent.click(toggleButton);

      expect(passwordInput.type).toBe('text');

      fireEvent.click(screen.getByRole('button', { name: /hide password/i }));
      expect(passwordInput.type).toBe('password');
    });

    it('submits credentials and sets session upon successful authentication', async () => {
      const mockPayload = {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        tokenType: 'Bearer',
        expiresIn: 900,
        user: {
          id: 'user-1',
          username: 'john_doe',
          displayName: 'John Doe',
          nexaVoiceId: 'NV-1234-5678',
          roles: ['USER'],
          accountState: 'ACTIVE',
        },
      };

      const loginSpy = vi.spyOn(authApi, 'login').mockResolvedValue(mockPayload);

      renderWithClient(<LoginForm />);

      fireEvent.change(screen.getByPlaceholderText(/name@company.com or username/i), {
        target: { value: 'john_doe' },
      });
      fireEvent.change(screen.getByPlaceholderText('••••••••'), {
        target: { value: 'ValidPassword123!' },
      });

      const submitButton = screen.getByRole('button', { name: /sign in/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(loginSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            identifier: 'john_doe',
            password: 'ValidPassword123!',
          }),
        );
        expect(authService.isAuthenticated()).toBe(true);
        expect(authService.getUser()?.username).toBe('john_doe');
      });
    });

    it('displays error banner when authentication fails', async () => {
      vi.spyOn(authApi, 'login').mockRejectedValue(new Error('Invalid credentials'));

      renderWithClient(<LoginForm />);

      fireEvent.change(screen.getByPlaceholderText(/name@company.com or username/i), {
        target: { value: 'wrong_user' },
      });
      fireEvent.change(screen.getByPlaceholderText('••••••••'), {
        target: { value: 'WrongPass123!' },
      });

      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(
          /invalid identifier or password/i,
        );
      });
    });
  });

  // ==========================================
  // 2. SIGNUP FLOW
  // ==========================================
  describe('SignupForm', () => {
    it('validates password mismatch between password and confirm password', async () => {
      renderWithClient(<SignupForm />);

      fireEvent.change(screen.getByPlaceholderText(/elena rostova/i), {
        target: { value: 'Elena Rostova' },
      });
      fireEvent.change(screen.getByPlaceholderText(/elena_rostova/i), {
        target: { value: 'elena_rostova' },
      });
      fireEvent.change(screen.getByPlaceholderText(/elena@company.com/i), {
        target: { value: 'elena@company.com' },
      });
      fireEvent.change(screen.getByPlaceholderText(/at least 8 characters/i), {
        target: { value: 'Password123!' },
      });
      fireEvent.change(screen.getByPlaceholderText(/re-enter password/i), {
        target: { value: 'DifferentPassword123!' },
      });

      fireEvent.click(screen.getByRole('button', { name: /create nexavoice account/i }));

      await waitFor(() => {
        expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
      });
    });

    it('validates work email format', async () => {
      renderWithClient(<SignupForm />);

      fireEvent.change(screen.getByPlaceholderText(/elena@company.com/i), {
        target: { value: 'not-an-email' },
      });

      fireEvent.click(screen.getByRole('button', { name: /create nexavoice account/i }));

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
      });
    });

    it('submits registration successfully when all fields valid', async () => {
      const mockPayload = {
        accessToken: 'reg-access-token',
        refreshToken: 'reg-refresh-token',
        tokenType: 'Bearer',
        expiresIn: 900,
        user: {
          id: 'user-new',
          username: 'elena_rostova',
          displayName: 'Elena Rostova',
          nexaVoiceId: 'NV-9999-1111',
          roles: ['USER'],
          accountState: 'ACTIVE',
        },
      };

      const registerSpy = vi.spyOn(authApi, 'register').mockResolvedValue(mockPayload);

      renderWithClient(<SignupForm />);

      fireEvent.change(screen.getByPlaceholderText(/elena rostova/i), {
        target: { value: 'Elena Rostova' },
      });
      fireEvent.change(screen.getByPlaceholderText(/elena_rostova/i), {
        target: { value: 'elena_rostova' },
      });
      fireEvent.change(screen.getByPlaceholderText(/elena@company.com/i), {
        target: { value: 'elena@company.com' },
      });
      fireEvent.change(screen.getByPlaceholderText(/at least 8 characters/i), {
        target: { value: 'SecurePass123!' },
      });
      fireEvent.change(screen.getByPlaceholderText(/re-enter password/i), {
        target: { value: 'SecurePass123!' },
      });

      fireEvent.click(screen.getByRole('button', { name: /create nexavoice account/i }));

      await waitFor(() => {
        expect(registerSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            username: 'elena_rostova',
            displayName: 'Elena Rostova',
            email: 'elena@company.com',
            password: 'SecurePass123!',
          }),
        );
        expect(authService.isAuthenticated()).toBe(true);
      });
    });
  });

  // ==========================================
  // 3. FORGOT PASSWORD FLOW
  // ==========================================
  describe('ForgotPasswordForm', () => {
    it('validates email requirement and format', async () => {
      renderWithClient(<ForgotPasswordForm />);

      fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

      await waitFor(() => {
        expect(screen.getByText(/email is required/i)).toBeInTheDocument();
      });

      fireEvent.change(screen.getByPlaceholderText('you@company.com'), {
        target: { value: 'invalid-email' },
      });

      await waitFor(() => {
        expect(screen.getByText(/please enter a valid email address/i)).toBeInTheDocument();
      });
    });

    it('dispatches reset request and transitions to success confirmation screen', async () => {
      const resetSpy = vi.spyOn(authApi, 'requestPasswordReset').mockResolvedValue({
        success: true,
        message: 'Password reset instructions have been sent.',
      });

      renderWithClient(<ForgotPasswordForm />);

      fireEvent.change(screen.getByPlaceholderText('you@company.com'), {
        target: { value: 'recover@company.com' },
      });

      fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

      await waitFor(() => {
        expect(resetSpy).toHaveBeenCalledWith('recover@company.com');
        expect(screen.getByText(/reset instructions dispatched/i)).toBeInTheDocument();
        expect(screen.getByText(/recover@company.com/)).toBeInTheDocument();
      });
    });
  });

  // ==========================================
  // 4. RESET PASSWORD FLOW
  // ==========================================
  describe('ResetPasswordForm', () => {
    it('shows missing/invalid token state if no token provided', () => {
      renderWithClient(<ResetPasswordForm token={undefined} />);

      expect(screen.getByText(/invalid or missing token/i)).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: /request new reset link/i }),
      ).toBeInTheDocument();
    });

    it('submits new password when token is present and shows success state', async () => {
      const resetSpy = vi.spyOn(authApi, 'resetPassword').mockResolvedValue({
        success: true,
        message: 'Password updated successfully.',
      });

      renderWithClient(<ResetPasswordForm token="valid-secret-token-123" />);

      fireEvent.change(screen.getByPlaceholderText(/at least 8 characters/i), {
        target: { value: 'NewSecurePass123!' },
      });
      fireEvent.change(screen.getByPlaceholderText(/re-enter password/i), {
        target: { value: 'NewSecurePass123!' },
      });

      fireEvent.click(screen.getByRole('button', { name: /reset password/i }));

      await waitFor(() => {
        expect(resetSpy).toHaveBeenCalledWith('valid-secret-token-123', 'NewSecurePass123!');
        expect(screen.getByText(/password updated successfully/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /proceed to sign in/i })).toBeInTheDocument();
      });
    });
  });

  // ==========================================
  // 5. PASSWORD STRENGTH METER
  // ==========================================
  describe('PasswordStrengthMeter', () => {
    it('renders correct labels based on password complexity', () => {
      const { rerender } = render(<PasswordStrengthMeter password="" />);
      expect(screen.queryByText(/password strength/i)).not.toBeInTheDocument();

      rerender(<PasswordStrengthMeter password="short" />);
      expect(screen.getByText(/very weak/i)).toBeInTheDocument();

      rerender(<PasswordStrengthMeter password="Password123" />);
      expect(screen.getByText(/fair|good/i)).toBeInTheDocument();

      rerender(<PasswordStrengthMeter password="VeryStrongPassword123!@#" />);
      expect(screen.getByText(/strong/i)).toBeInTheDocument();
    });
  });

  // ==========================================
  // 6. TOAST SERVICE & DEDUPLICATION
  // ==========================================
  describe('Toast Notification System', () => {
    it('provides success, error, warning, and info toast methods without crashing', () => {
      expect(() => {
        toastService.success('Action succeeded');
        toastService.error('Action failed');
        toastService.warning('Be careful');
        toastService.info('Informational message');
      }).not.toThrow();
    });
  });

  // ==========================================
  // 7. AUTH LAYOUT & THEME TOGGLE
  // ==========================================
  describe('AuthLayout', () => {
    it('renders layout with title, subtitle, and toggles dark/light theme', () => {
      render(
        <AuthLayout title="Test Title" subtitle="Test Subtitle">
          <div>Child Form Content</div>
        </AuthLayout>,
      );

      expect(screen.getByText('Test Title')).toBeInTheDocument();
      expect(screen.getByText('Test Subtitle')).toBeInTheDocument();
      expect(screen.getByText('Child Form Content')).toBeInTheDocument();

      const themeToggle = screen.getByRole('button', { name: /switch to/i });
      expect(themeToggle).toBeInTheDocument();

      const initialTheme = document.documentElement.getAttribute('data-theme') || 'dark';
      fireEvent.click(themeToggle);
      const updatedTheme = document.documentElement.getAttribute('data-theme');

      expect(updatedTheme).not.toBe(initialTheme);
    });
  });
});
