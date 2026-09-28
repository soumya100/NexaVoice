import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../services/auth-api';
import { authService } from '../../../services/auth';
import { toastService } from '../../../services/toast';
import {
  AuthResponsePayload,
  LoginFormData,
  PasswordResetResponse,
  SignupFormData,
} from '../types';

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) {
    // Sanitize technical or graphql internal strings
    if (err.message.includes('Invalid credentials')) {
      return 'Unable to sign in. Please verify your identifier and password.';
    }
    if (err.message.includes('Account is temporarily locked')) {
      return 'Account is temporarily locked due to multiple failed attempts. Please try again later.';
    }
    if (err.message.includes('Username is already taken')) {
      return 'This username is already taken. Please choose another.';
    }
    if (err.message.includes('Email is already registered')) {
      return 'An account is already registered with this email address.';
    }
    if (err.message.includes('Invalid or expired')) {
      return 'The password reset link is invalid or has expired. Please request a new one.';
    }
    return err.message;
  }
  return fallback;
}

export function useLoginMutation(options?: {
  onSuccess?: (data: AuthResponsePayload) => void;
  onError?: (err: Error) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: LoginFormData) => authApi.login(data),
    onSuccess: (data) => {
      authService.setSession(data.user, data.accessToken, data.refreshToken);
      try {
        localStorage.setItem('nv_last_identifier', data.user.username || data.user.email || '');
      } catch {
        // ignore storage errors
      }
      queryClient.clear();
      toastService.success(`Welcome back, ${data.user.displayName || data.user.username}!`);
      options?.onSuccess?.(data);
    },
    onError: (err: Error) => {
      const friendlyMessage = extractErrorMessage(
        err,
        'Unable to sign in. Please check your credentials.',
      );
      toastService.error(friendlyMessage);
      options?.onError?.(err);
    },
  });
}

export function useSignupMutation(options?: {
  onSuccess?: (data: AuthResponsePayload) => void;
  onError?: (err: Error) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SignupFormData) => authApi.register(data),
    onSuccess: (data) => {
      authService.setSession(data.user, data.accessToken, data.refreshToken);
      try {
        localStorage.setItem('nv_last_identifier', data.user.username || data.user.email || '');
      } catch {
        // ignore storage errors
      }
      queryClient.clear();
      toastService.success('Account created successfully! Welcome to NexaVoice.');
      options?.onSuccess?.(data);
    },
    onError: (err: Error) => {
      const friendlyMessage = extractErrorMessage(
        err,
        'Registration could not be completed. Please try again.',
      );
      toastService.error(friendlyMessage);
      options?.onError?.(err);
    },
  });
}

export function useForgotPasswordMutation(options?: {
  onSuccess?: (data: PasswordResetResponse) => void;
  onError?: (err: Error) => void;
}) {
  return useMutation({
    mutationFn: (email: string) => authApi.requestPasswordReset(email),
    onSuccess: (data) => {
      toastService.success(data.message || 'Password reset instructions have been sent.');
      options?.onSuccess?.(data);
    },
    onError: (err: Error) => {
      const friendlyMessage = extractErrorMessage(
        err,
        'Unable to send reset instructions. Please check the email address.',
      );
      toastService.error(friendlyMessage);
      options?.onError?.(err);
    },
  });
}

export function useResetPasswordMutation(options?: {
  onSuccess?: (data: PasswordResetResponse) => void;
  onError?: (err: Error) => void;
}) {
  return useMutation({
    mutationFn: ({ token, newPassword }: { token: string; newPassword: string }) =>
      authApi.resetPassword(token, newPassword),
    onSuccess: (data) => {
      toastService.success('Password updated successfully. You can now sign in.');
      options?.onSuccess?.(data);
    },
    onError: (err: Error) => {
      const friendlyMessage = extractErrorMessage(
        err,
        'Failed to reset password. The link may have expired.',
      );
      toastService.error(friendlyMessage);
      options?.onError?.(err);
    },
  });
}
