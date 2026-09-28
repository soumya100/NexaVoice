import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from '@tanstack/react-router';
import { Eye, EyeOff, Loader2, UserPlus, AlertCircle } from 'lucide-react';
import { signupSchema } from '../validation';
import { SignupFormData } from '../types';
import { useSignupMutation } from '../hooks/useAuthMutations';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';

export function SignupForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      displayName: '',
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
    mode: 'onTouched',
  });

  const currentPassword = watch('password');

  const signupMutation = useSignupMutation({
    onSuccess: () => {
      navigate({ to: '/app/conversations' as any });
    },
  });

  const onSubmit = (data: SignupFormData) => {
    signupMutation.mutate(data);
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
    >
      {/* Global Mutation Error Banner (if any) */}
      {signupMutation.isError && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 14px',
            borderRadius: '10px',
            background: 'rgba(244, 63, 94, 0.1)',
            border: '1px solid var(--nv-danger, #f43f5e)',
            color: 'var(--nv-danger, #f43f5e)',
            fontSize: '13px',
            lineHeight: 1.4,
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>
            {signupMutation.error instanceof Error
              ? signupMutation.error.message.includes('Username is already taken')
                ? 'This username is already taken. Please select a different username.'
                : signupMutation.error.message.includes('Email is already registered')
                ? 'An account with this email address already exists.'
                : signupMutation.error.message
              : 'Registration could not be completed. Please try again.'}
          </span>
        </div>
      )}

      {/* Full Name / Display Name */}
      <div>
        <label
          htmlFor="signup-display-name"
          style={{
            display: 'block',
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--nv-text-secondary, #94a3b8)',
            marginBottom: '4px',
          }}
        >
          Full Name
        </label>
        <input
          id="signup-display-name"
          type="text"
          autoComplete="name"
          placeholder="e.g. Elena Rostova"
          aria-invalid={!!errors.displayName}
          aria-describedby={errors.displayName ? 'displayName-error' : undefined}
          {...register('displayName')}
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: '10px',
            background: 'var(--nv-bg-canvas, #090d16)',
            border: errors.displayName
              ? '1px solid var(--nv-danger, #f43f5e)'
              : '1px solid var(--nv-border, #1e293b)',
            color: 'var(--nv-text-primary, #f8fafc)',
            fontSize: '14px',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        {errors.displayName && (
          <span
            id="displayName-error"
            role="alert"
            style={{
              display: 'block',
              color: 'var(--nv-danger, #f43f5e)',
              fontSize: '12px',
              marginTop: '4px',
              fontWeight: 500,
            }}
          >
            {errors.displayName.message}
          </span>
        )}
      </div>

      {/* Username */}
      <div>
        <label
          htmlFor="signup-username"
          style={{
            display: 'block',
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--nv-text-secondary, #94a3b8)',
            marginBottom: '4px',
          }}
        >
          Username
        </label>
        <input
          id="signup-username"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="e.g. elena_rostova"
          aria-invalid={!!errors.username}
          aria-describedby={errors.username ? 'username-error' : undefined}
          {...register('username')}
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: '10px',
            background: 'var(--nv-bg-canvas, #090d16)',
            border: errors.username
              ? '1px solid var(--nv-danger, #f43f5e)'
              : '1px solid var(--nv-border, #1e293b)',
            color: 'var(--nv-text-primary, #f8fafc)',
            fontSize: '14px',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        {errors.username && (
          <span
            id="username-error"
            role="alert"
            style={{
              display: 'block',
              color: 'var(--nv-danger, #f43f5e)',
              fontSize: '12px',
              marginTop: '4px',
              fontWeight: 500,
            }}
          >
            {errors.username.message}
          </span>
        )}
      </div>

      {/* Work Email */}
      <div>
        <label
          htmlFor="signup-email"
          style={{
            display: 'block',
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--nv-text-secondary, #94a3b8)',
            marginBottom: '4px',
          }}
        >
          Work Email
        </label>
        <input
          id="signup-email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="elena@company.com"
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
          {...register('email')}
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: '10px',
            background: 'var(--nv-bg-canvas, #090d16)',
            border: errors.email
              ? '1px solid var(--nv-danger, #f43f5e)'
              : '1px solid var(--nv-border, #1e293b)',
            color: 'var(--nv-text-primary, #f8fafc)',
            fontSize: '14px',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        {errors.email && (
          <span
            id="email-error"
            role="alert"
            style={{
              display: 'block',
              color: 'var(--nv-danger, #f43f5e)',
              fontSize: '12px',
              marginTop: '4px',
              fontWeight: 500,
            }}
          >
            {errors.email.message}
          </span>
        )}
      </div>

      {/* Password with Strength Meter */}
      <div>
        <label
          htmlFor="signup-password"
          style={{
            display: 'block',
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--nv-text-secondary, #94a3b8)',
            marginBottom: '4px',
          }}
        >
          Password
        </label>
        <div style={{ position: 'relative' }}>
          <input
            id="signup-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="At least 8 characters"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? 'password-error' : undefined}
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
            id="password-error"
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
          htmlFor="signup-confirm-password"
          style={{
            display: 'block',
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--nv-text-secondary, #94a3b8)',
            marginBottom: '4px',
          }}
        >
          Confirm Password
        </label>
        <div style={{ position: 'relative' }}>
          <input
            id="signup-confirm-password"
            type={showConfirmPassword ? 'text' : 'password'}
            autoComplete="new-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Re-enter password"
            aria-invalid={!!errors.confirmPassword}
            aria-describedby={errors.confirmPassword ? 'confirmPassword-error' : undefined}
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
            id="confirmPassword-error"
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
        disabled={signupMutation.isPending}
        style={{
          width: '100%',
          padding: '12px 18px',
          borderRadius: '10px',
          background: signupMutation.isPending
            ? 'var(--nv-border, #334155)'
            : 'linear-gradient(135deg, var(--nv-status-online, #10b981) 0%, #059669 100%)',
          color: '#ffffff',
          fontSize: '14px',
          fontWeight: 600,
          border: 'none',
          cursor: signupMutation.isPending ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
          transition: 'transform 100ms ease, opacity 150ms ease, box-shadow 150ms ease',
          marginTop: '6px',
        }}
      >
        {signupMutation.isPending ? (
          <>
            <Loader2 size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
            <span>Creating your account...</span>
          </>
        ) : (
          <>
            <UserPlus size={16} />
            <span>Create NexaVoice Account</span>
          </>
        )}
      </button>

      {/* Switch to Sign In */}
      <div
        style={{
          textAlign: 'center',
          marginTop: '8px',
          fontSize: '13px',
          color: 'var(--nv-text-secondary, #94a3b8)',
        }}
      >
        Already have an account?{' '}
        <Link
          to="/auth/login"
          style={{
            color: 'var(--nv-cyan, #06b6d4)',
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          Sign In
        </Link>
      </div>
    </form>
  );
}
