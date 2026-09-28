import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { Eye, EyeOff, Loader2, LogIn, AlertCircle } from 'lucide-react';
import { loginSchema } from '../validation';
import { LoginFormData } from '../types';
import { useLoginMutation } from '../hooks/useAuthMutations';
import { authService } from '../../../services/auth';

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  // Safely extract redirect destination if available
  let searchRedirect: string | undefined;
  try {
    const search = useSearch({ strict: false }) as { redirect?: string };
    searchRedirect = search?.redirect;
  } catch {
    searchRedirect = undefined;
  }

  const defaultIdentifier = typeof window !== 'undefined' ? localStorage.getItem('nv_last_identifier') || '' : '';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: defaultIdentifier,
      password: '',
      rememberMe: false,
    },
    mode: 'onTouched',
  });

  const loginMutation = useLoginMutation({
    onSuccess: () => {
      const destination = authService.validateRedirect(searchRedirect);
      // TanStack Router navigation or safe window location
      if (destination.startsWith('/app/')) {
        navigate({ to: destination as any });
      } else {
        window.location.href = destination;
      }
    },
  });

  const onSubmit = (data: LoginFormData) => {
    loginMutation.mutate(data);
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}
    >
      {/* Global Mutation Error Banner (if any) */}
      {loginMutation.isError && (
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
            {loginMutation.error instanceof Error
              ? loginMutation.error.message.includes('Invalid credentials')
                ? 'Invalid identifier or password. Please verify your credentials.'
                : loginMutation.error.message
              : 'Sign in failed. Please check your credentials.'}
          </span>
        </div>
      )}

      {/* Identifier Field */}
      <div>
        <label
          htmlFor="login-identifier"
          style={{
            display: 'block',
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--nv-text-secondary, #94a3b8)',
            marginBottom: '6px',
          }}
        >
          Email, Username, or Display Name
        </label>
        <input
          id="login-identifier"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder="name@company.com or username"
          aria-invalid={!!errors.identifier}
          aria-describedby={errors.identifier ? 'identifier-error' : undefined}
          {...register('identifier')}
          style={{
            width: '100%',
            padding: '11px 14px',
            borderRadius: '10px',
            background: 'var(--nv-bg-canvas, #090d16)',
            border: errors.identifier
              ? '1px solid var(--nv-danger, #f43f5e)'
              : '1px solid var(--nv-border, #1e293b)',
            color: 'var(--nv-text-primary, #f8fafc)',
            fontSize: '14px',
            outline: 'none',
            boxSizing: 'border-box',
            transition: 'border-color 150ms ease, box-shadow 150ms ease',
          }}
        />
        {errors.identifier && (
          <span
            id="identifier-error"
            role="alert"
            style={{
              display: 'block',
              color: 'var(--nv-danger, #f43f5e)',
              fontSize: '12px',
              marginTop: '4px',
              fontWeight: 500,
            }}
          >
            {errors.identifier.message}
          </span>
        )}
      </div>

      {/* Password Field */}
      <div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '6px',
          }}
        >
          <label
            htmlFor="login-password"
            style={{
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--nv-text-secondary, #94a3b8)',
            }}
          >
            Password
          </label>
          <Link
            to="/auth/forgot-password"
            style={{
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--nv-cyan, #06b6d4)',
              textDecoration: 'none',
              transition: 'opacity 150ms ease',
            }}
          >
            Forgot password?
          </Link>
        </div>

        <div style={{ position: 'relative' }}>
          <input
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="••••••••"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? 'password-error' : undefined}
            {...register('password')}
            style={{
              width: '100%',
              padding: '11px 40px 11px 14px',
              borderRadius: '10px',
              background: 'var(--nv-bg-canvas, #090d16)',
              border: errors.password
                ? '1px solid var(--nv-danger, #f43f5e)'
                : '1px solid var(--nv-border, #1e293b)',
              color: 'var(--nv-text-primary, #f8fafc)',
              fontSize: '14px',
              outline: 'none',
              boxSizing: 'border-box',
              transition: 'border-color 150ms ease, box-shadow 150ms ease',
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

      {/* Remember Me Checkbox */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input
          id="login-remember"
          type="checkbox"
          {...register('rememberMe')}
          style={{
            accentColor: 'var(--nv-primary, #6366f1)',
            width: '16px',
            height: '16px',
            cursor: 'pointer',
          }}
        />
        <label
          htmlFor="login-remember"
          style={{
            fontSize: '13px',
            color: 'var(--nv-text-secondary, #94a3b8)',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          Remember this device for 30 days
        </label>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loginMutation.isPending}
        style={{
          width: '100%',
          padding: '12px 18px',
          borderRadius: '10px',
          background: loginMutation.isPending
            ? 'var(--nv-border, #334155)'
            : 'linear-gradient(135deg, var(--nv-primary, #6366f1) 0%, #4f46e5 100%)',
          color: '#ffffff',
          fontSize: '14px',
          fontWeight: 600,
          border: 'none',
          cursor: loginMutation.isPending ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
          transition: 'transform 100ms ease, opacity 150ms ease, box-shadow 150ms ease',
          marginTop: '6px',
        }}
      >
        {loginMutation.isPending ? (
          <>
            <Loader2 size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
            <span>Signing in...</span>
          </>
        ) : (
          <>
            <LogIn size={16} />
            <span>Sign in to NexaVoice</span>
          </>
        )}
      </button>

      {/* Switch to Signup */}
      <div
        style={{
          textAlign: 'center',
          marginTop: '12px',
          fontSize: '13px',
          color: 'var(--nv-text-secondary, #94a3b8)',
        }}
      >
        Don't have an account?{' '}
        <Link
          to="/auth/register"
          style={{
            color: 'var(--nv-cyan, #06b6d4)',
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          Create account
        </Link>
      </div>
    </form>
  );
}
