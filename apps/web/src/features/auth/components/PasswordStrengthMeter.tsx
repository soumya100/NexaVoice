import { Check, ShieldCheck } from 'lucide-react';

interface PasswordStrengthMeterProps {
  password?: string;
}

export function PasswordStrengthMeter({ password = '' }: PasswordStrengthMeterProps) {
  if (!password) return null;

  const hasLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);

  let score = 0;
  if (hasLength) score++;
  if (hasLetter && hasNumber) score++;
  if (password.length >= 12) score++;
  if (hasSpecial) score++;

  const strengthConfig = [
    { label: 'Very Weak', color: '#f43f5e' },
    { label: 'Weak', color: '#f43f5e' },
    { label: 'Fair', color: '#f59e0b' },
    { label: 'Good', color: '#06b6d4' },
    { label: 'Strong', color: '#10b981' },
  ];

  const current = strengthConfig[score] || strengthConfig[0];

  return (
    <div style={{ marginTop: '8px', marginBottom: '4px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '6px',
        }}
      >
        <span
          style={{
            fontSize: '11px',
            color: 'var(--nv-text-muted, #94a3b8)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <ShieldCheck size={12} color={current.color} />
          Password strength
        </span>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: current.color,
            transition: 'color 200ms ease',
          }}
        >
          {current.label}
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '4px',
          height: '4px',
        }}
        aria-hidden="true"
      >
        {[1, 2, 3, 4].map((step) => {
          const active = score >= step;
          return (
            <div
              key={step}
              style={{
                height: '100%',
                borderRadius: '2px',
                background: active ? current.color : 'rgba(255,255,255,0.08)',
                transition: 'background-color 250ms ease',
              }}
            />
          );
        })}
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px 12px',
          marginTop: '8px',
          fontSize: '11px',
          color: 'var(--nv-text-muted, #94a3b8)',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            color: hasLength ? 'var(--nv-status-online, #10b981)' : 'inherit',
          }}
        >
          <Check size={11} strokeWidth={hasLength ? 3 : 2} /> 8+ chars
        </span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            color: hasLetter && hasNumber ? 'var(--nv-status-online, #10b981)' : 'inherit',
          }}
        >
          <Check size={11} strokeWidth={hasLetter && hasNumber ? 3 : 2} /> Letters & numbers
        </span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            color: hasSpecial ? 'var(--nv-status-online, #10b981)' : 'inherit',
          }}
        >
          <Check size={11} strokeWidth={hasSpecial ? 3 : 2} /> Special char
        </span>
      </div>
    </div>
  );
}
