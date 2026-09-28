import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import {
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  KeyRound,
} from 'lucide-react';
import { resetPasswordSchema } from '../validation';
import { ResetPasswordFormData } from '../types';
import { useResetPasswordMutation } from '../hooks/useAuthMutations';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';

interface ResetPasswordFormProps {
  token?: string;
}

export function ResetPasswordForm({ token: propToken }: ResetPasswordFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();

  // Extract token from prop or search params
  let urlToken: string | undefined = propToken;
  try {
    const search = useSearch({ strict: false }) as { token?: string };
    if (!urlToken && search?.token) {
      urlToken = search.token;
    }
  } catch {
    // fallback if route doesn't have search schema configured
  }

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
    mode: 'onTouched',
  });

  const currentPassword = watch('password');

  const resetPasswordMutation = useResetPasswordMutation({
    onSuccess: () => {
      // Form switches to success confirmation state
    },
  });

  const onSubmit = (data: ResetPasswordFormData) => {
    if (!urlToken) return;
    resetPasswordMutation.mutate({
      token: urlToken,
      newPassword: data.password,
    });
  };

  // Case 1: Missing or Invalid Token State
  if (!urlToken) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          padding: '12px 0',
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'rgba(244, 63, 94, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--nv-danger, #f43f5e)',
            marginBottom: '18px',
          }}
        >
          <AlertTriangle size={30} />
        </div>

        <h2
          style={{
            fontSize: '18px',
            fontWeight: 700,
            marginBottom: '8px',
            color: 'var(--nv-text-primary, #f8fafc)',
          }}
        >
          Invalid or Missing Token
        </h2>

        <p
          style={{
            fontSize: '13.5px',
            color: 'var(--nv-text-secondary, #94a3b8)',
            lineHeight: 1.5,
            marginBottom: '24px',
            maxWidth: '360px',
          }}
        >
          The password reset link appears to be invalid, incomplete, or already used.
          For security, password reset links expire after 1 hour.
        </p>

        <Link
          to="/auth/forgot-password"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            width: '100%',
            padding: '12px 18px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, var(--nv-primary, #6366f1) 0%, #4f46e5 100%)',
            color: '#ffffff',
            fontSize: '14px',
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Request New Reset Link
        </Link>
      </div>
    );
  }

  // Case 2: Successful Password Reset Confirmation
  if (resetPasswordMutation.isSuccess) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          padding: '12px 0',
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'rgba(16, 185, 129, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--nv-status-online, #10b981)',
            marginBottom: '18px',
          }}
        >
          <CheckCircle2 size={32} />
        </div>

        <h2
          style={{
            fontSize: '18px',
            fontWeight: 700,
            marginBottom: '8px',
            color: 'var(--nv-text-primary, #f8fafc)',
          }}
        >
          Password updated successfully
        </h2>

        <p
          style={{
            fontSize: '13.5px',
            color: 'var(--nv-text-secondary, #94a3b8)',
            lineHeight: 1.5,
            marginBottom: '24px',
            maxWidth: '360px',
          }}
        >
          Your password has been changed securely and any active sessions have been terminated.
          You can now sign in with your new credentials.
        </p>

        <button
          type="button"
          onClick={() => navigate({ to: '/auth/login' as any })}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            width: '100%',
            padding: '12px 18px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, var(--nv-status-online, #10b981) 0%, #059669 100%)',
            color: '#ffffff',
            fontSize: '14px',
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <span>Proceed to Sign In</span>
          <ArrowRight size={16} />
        </button>
      </div>
    );
  }

  // Case 3: Reset Form
  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
    >
      <p
        style={{
          fontSize: '13.5px',
          color: 'var(--nv-text-secondary, #94a3b8)',
          lineHeight: 1.5,
          margin: 0,
        }}
      >
        Choose a strong, unique password for your NexaVoice account.
      </p>

      {/* New Password */}
      <div>
        <label
          htmlFor="reset-password"
          style={{
            display: 'block',
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--nv-text-secondary, #94a3b8)',
            marginBottom: '4px',
          }}
        >
          New Password
        </label>
        <div style={{ position: 'relative' }}>
          <input
            id="reset-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? 'reset-password-error' : undefined}
            {...register('password')}
            style={{
              width: '100%',
              padding: '10px 40px 10px 14px',
              borderRadius: '10px',
              background: 'var(--nv-bg-canvas, #090d16)',
              border: errors.password
                ? '1px solid var(--nv-danger, #f43f5e)'
                : '1px solid var(--nv-border, #1e293b)',
              color: 'var(--nv-text-primary, #f8fafc)',
              fontSize: '14px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            title={showPassword ? 'Hide password' : 'Show password'}
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--nv-text-muted, #64748b)',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <PasswordStrengthMeter password={currentPassword} />
        {errors.password && (
          <span
            id="reset-password-error"
            role="alert"
            style={{
              display: 'block',
              color: 'var(--nv-danger, #f43f5e)',
              fontSize: '12px',
              marginTop: '4px',
              fontWeight: 500,
            }}
          >
            {errors.password.message}
          </span>
        )}
      </div>

      {/* Confirm Password */}
      <div>
        <label
          htmlFor="reset-confirm-password"
          style={{
            display: 'block',
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--nv-text-secondary, #94a3b8)',
            marginBottom: '4px',
          }}
        >
          Confirm New Password
        </label>
        <div style={{ position: 'relative' }}>
          <input
            id="reset-confirm-password"
            type={showConfirmPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Re-enter password"
            aria-invalid={!!errors.confirmPassword}
            aria-describedby={errors.confirmPassword ? 'reset-confirm-error' : undefined}
            {...register('confirmPassword')}
            style={{
              width: '100%',
              padding: '10px 40px 10px 14px',
              borderRadius: '10px',
              background: 'var(--nv-bg-canvas, #090d16)',
              border: errors.confirmPassword
                ? '1px solid var(--nv-danger, #f43f5e)'
                : '1px solid var(--nv-border, #1e293b)',
              color: 'var(--nv-text-primary, #f8fafc)',
              fontSize: '14px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
            title={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--nv-text-muted, #64748b)',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {errors.confirmPassword && (
          <span
            id="reset-confirm-error"
            role="alert"
            style={{
              display: 'block',
              color: 'var(--nv-danger, #f43f5e)',
              fontSize: '12px',
              marginTop: '4px',
              fontWeight: 500,
            }}
          >
            {errors.confirmPassword.message}
          </span>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={resetPasswordMutation.isPending}
        style={{
          width: '100%',
          padding: '12px 18px',
          borderRadius: '10px',
          background: resetPasswordMutation.isPending
            ? 'var(--nv-border, #334155)'
            : 'linear-gradient(135deg, var(--nv-primary, #6366f1) 0%, #4f46e5 100%)',
          color: '#ffffff',
          fontSize: '14px',
          fontWeight: 600,
          border: 'none',
          cursor: resetPasswordMutation.isPending ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
          transition: 'transform 100ms ease, opacity 150ms ease',
          marginTop: '6px',
        }}
      >
        {resetPasswordMutation.isPending ? (
          <>
            <Loader2 size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
            <span>Updating password...</span>
          </>
        ) : (
          <>
            <KeyRound size={16} />
            <span>Reset Password</span>
          </>
        )}
      </button>

      {/* Back to Login */}
      <div style={{ textAlign: 'center', marginTop: '6px' }}>
        <Link
          to="/auth/login"
          style={{
            color: 'var(--nv-text-secondary, #94a3b8)',
            fontSize: '13px',
            textDecoration: 'none',
            fontWeight: 500,
          }}
        >
          Cancel and return to Sign In
        </Link>
      </div>
    </form>
  );
}
