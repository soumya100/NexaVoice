import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from '@tanstack/react-router';
import { ArrowLeft, CheckCircle2, Mail, Loader2, Send } from 'lucide-react';
import { forgotPasswordSchema } from '../validation';
import { ForgotPasswordFormData } from '../types';
import { useForgotPasswordMutation } from '../hooks/useAuthMutations';

export function ForgotPasswordForm() {
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
    mode: 'onTouched',
  });

  const forgotPasswordMutation = useForgotPasswordMutation({
    onSuccess: () => {
      // Transition to success confirmation state
    },
  });

  const onSubmit = (data: ForgotPasswordFormData) => {
    setSubmittedEmail(data.email);
    forgotPasswordMutation.mutate(data.email);
  };

  if (submittedEmail && forgotPasswordMutation.isSuccess) {
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
          Reset instructions dispatched
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
          If an account exists for <strong style={{ color: 'var(--nv-text-primary, #f8fafc)' }}>{submittedEmail}</strong>,
          you will receive an email with instructions to securely choose a new password.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
          <button
            type="button"
            onClick={() => setSubmittedEmail(null)}
            style={{
              width: '100%',
              padding: '10px 16px',
              borderRadius: '10px',
              background: 'transparent',
              border: '1px solid var(--nv-border, #1e293b)',
              color: 'var(--nv-text-secondary, #94a3b8)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 150ms ease',
            }}
          >
            Didn't receive email? Try another address
          </button>

          <Link
            to="/auth/login"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              color: 'var(--nv-cyan, #06b6d4)',
              fontSize: '13.5px',
              fontWeight: 600,
              textDecoration: 'none',
              padding: '8px',
            }}
          >
            <ArrowLeft size={16} /> Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
    >
      <p
        style={{
          fontSize: '13.5px',
          color: 'var(--nv-text-secondary, #94a3b8)',
          lineHeight: 1.5,
          margin: 0,
        }}
      >
        Enter the email address associated with your account and we'll send you
        instructions to reset your password.
      </p>

      {/* Email Field */}
      <div>
        <label
          htmlFor="forgot-email"
          style={{
            display: 'block',
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--nv-text-secondary, #94a3b8)',
            marginBottom: '6px',
          }}
        >
          Email Address
        </label>
        <div style={{ position: 'relative' }}>
          <input
            id="forgot-email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'forgot-email-error' : undefined}
            {...register('email')}
            style={{
              width: '100%',
              padding: '11px 14px 11px 38px',
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
          <Mail
            size={16}
            color="var(--nv-text-muted, #64748b)"
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
            }}
          />
        </div>
        {errors.email && (
          <span
            id="forgot-email-error"
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

      {/* Submit Button */}
      <button
        type="submit"
        disabled={forgotPasswordMutation.isPending}
        style={{
          width: '100%',
          padding: '12px 18px',
          borderRadius: '10px',
          background: forgotPasswordMutation.isPending
            ? 'var(--nv-border, #334155)'
            : 'linear-gradient(135deg, var(--nv-primary, #6366f1) 0%, #4f46e5 100%)',
          color: '#ffffff',
          fontSize: '14px',
          fontWeight: 600,
          border: 'none',
          cursor: forgotPasswordMutation.isPending ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
          transition: 'transform 100ms ease, opacity 150ms ease',
        }}
      >
        {forgotPasswordMutation.isPending ? (
          <>
            <Loader2 size={16} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
            <span>Sending reset link...</span>
          </>
        ) : (
          <>
            <Send size={16} />
            <span>Send Reset Link</span>
          </>
        )}
      </button>

      {/* Back to Login */}
      <div style={{ textAlign: 'center', marginTop: '6px' }}>
        <Link
          to="/auth/login"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--nv-text-secondary, #94a3b8)',
            fontSize: '13px',
            textDecoration: 'none',
            fontWeight: 500,
          }}
        >
          <ArrowLeft size={14} /> Back to Sign In
        </Link>
      </div>
    </form>
  );
}
