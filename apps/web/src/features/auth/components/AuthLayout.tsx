import { useState, useEffect } from 'react';
import { Radio, Shield, Zap, Sparkles, Moon, Sun, Lock } from 'lucide-react';

interface AuthLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (document.documentElement.getAttribute('data-theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'stretch',
        background: 'var(--nv-bg-canvas, #090d16)',
        color: 'var(--nv-text-primary, #f8fafc)',
        transition: 'background-color 250ms ease, color 250ms ease',
      }}
    >
      {/* =========================================================================
          LEFT COLUMN: Premium SaaS Showcase & Voice Visualization (Desktop only)
         ========================================================================= */}
      <aside
        className="auth-brand-pane"
        style={{
          flex: '1.1',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '35px 56px',
          position: 'relative',
          overflow: 'hidden',
          background:
            theme === 'dark'
              ? 'linear-gradient(145deg, rgba(15, 23, 42, 0.95), rgba(9, 13, 22, 0.98))'
              : 'linear-gradient(145deg, rgba(241, 245, 249, 0.95), rgba(248, 250, 252, 0.98))',
          borderRight: '1px solid var(--nv-border, #1e293b)',
        }}
      >
        {/* Subtle decorative radial gradients */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '-15%',
            left: '-10%',
            width: '450px',
            height: '450px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            bottom: '-10%',
            right: '-10%',
            width: '400px',
            height: '400px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(6, 182, 212, 0.12) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        {/* Top Branding */}
        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 16px rgba(99, 102, 241, 0.35)',
              }}
            >
              <Radio size={24} color="#ffffff" />
            </div>
            <span
              style={{
                fontSize: '22px',
                fontWeight: 800,
                letterSpacing: '-0.03em',
                fontFamily: 'var(--nv-font-display, inherit)',
              }}
            >
              Nexa<span style={{ color: 'var(--nv-cyan, #06b6d4)' }}>Voice</span>
            </span>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                padding: '2px 8px',
                borderRadius: '999px',
                background: 'rgba(99, 102, 241, 0.15)',
                color: 'var(--nv-primary, #6366f1)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
              }}
            >
              Enterprise
            </span>
          </div>
          <p
            style={{
              fontSize: '14px',
              color: 'var(--nv-text-muted, #94a3b8)',
              marginTop: '4px',
            }}
          >
            Unified communications & AI-driven conversational intelligence
          </p>
        </div>

        {/* Center: Dynamic Abstract Voice Visualization & Core Value Pitch */}
        <div style={{ position: 'relative', zIndex: 2, margin: '48px 0' }}>
          <h2
            style={{
              fontSize: '32px',
              fontWeight: 800,
              lineHeight: 1.2,
              marginBottom: '16px',
              fontFamily: 'var(--nv-font-display, inherit)',
              letterSpacing: '-0.025em',
            }}
          >
            Clarity that bridges <br />
            <span
              style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              every conversation.
            </span>
          </h2>
          <p
            style={{
              fontSize: '15px',
              lineHeight: 1.6,
              color: 'var(--nv-text-secondary, #94a3b8)',
              maxWidth: '440px',
              marginBottom: '32px',
            }}
          >
            From high-fidelity 1:1 voice calls to encrypted multi-party conferences
            and personal AI co-pilots, NexaVoice keeps your team synchronized anywhere.
          </p>

          {/* Interactive Voice Waveform Visualization */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '16px 20px',
              background: 'var(--nv-bg-surface, #0f172a)',
              borderRadius: '14px',
              border: '1px solid var(--nv-border, #1e293b)',
              width: 'fit-content',
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
              marginBottom: '36px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '3px', height: '24px' }}>
              {[12, 20, 8, 24, 16, 10, 22, 14, 6, 18, 24, 12, 16, 20, 8, 14, 22, 10].map(
                (h, idx) => (
                  <span
                    key={idx}
                    className="wave-bar"
                    style={{
                      height: `${h}px`,
                      animationDelay: `${idx * 0.08}s`,
                    }}
                  />
                ),
              )}
            </div>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--nv-cyan, #06b6d4)',
                marginLeft: '12px',
                letterSpacing: '0.02em',
              }}
            >
              HD Voice Engine • Active
            </span>
          </div>

          {/* Feature Highlights Grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'rgba(99, 102, 241, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--nv-primary, #6366f1)',
                }}
              >
                <Lock size={16} />
              </div>
              <span style={{ fontSize: '13px', fontWeight: 500 }}>
                End-to-End Encryption & Single-Use Session Tokens
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'rgba(6, 182, 212, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--nv-cyan, #06b6d4)',
                }}
              >
                <Zap size={16} />
              </div>
              <span style={{ fontSize: '13px', fontWeight: 500 }}>
                Ultra-Low-Latency WebRTC Signaling & Room Architecture
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'rgba(217, 70, 239, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--nv-ai-magenta, #d946ef)',
                }}
              >
                <Sparkles size={16} />
              </div>
              <span style={{ fontSize: '13px', fontWeight: 500 }}>
                Autonomous AI Meeting Assistant & Speaker Diarization
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Trust Lineage */}
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            paddingTop: '20px',
            borderTop: '1px solid var(--nv-border, #1e293b)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px',
            color: 'var(--nv-text-muted, #64748b)',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Shield size={14} color="var(--nv-status-online, #10b981)" /> Zero-Trust Security Standard
          </span>
          <span>© 2026 NexaVoice Inc.</span>
        </div>
      </aside>

      {/* =========================================================================
          RIGHT COLUMN: Form & User Experience Pane (Responsive)
         ========================================================================= */}
      <main
        style={{
          flex: '1',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '24px',
          position: 'relative',
        }}
      >
        {/* Top Controls: Theme Switcher & Mobile Brand Header */}
        <div
          style={{
            position: 'absolute',
            top: '24px',
            right: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            style={{
              padding: '8px',
              borderRadius: '10px',
              background: 'var(--nv-bg-surface, #0f172a)',
              border: '1px solid var(--nv-border, #1e293b)',
              color: 'var(--nv-text-secondary, #94a3b8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 150ms ease',
            }}
          >
            {theme === 'dark' ? (
              <Sun size={18} color="#f59e0b" />
            ) : (
              <Moon size={18} color="#6366f1" />
            )}
          </button>
        </div>

        {/* Mobile Brand Header (hidden on large screen via CSS) */}
        <div
          className="auth-mobile-header"
          style={{
            display: 'none',
            flexDirection: 'column',
            alignItems: 'center',
            marginBottom: '24px',
          }}
        >
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '10px',
              boxShadow: '0 4px 16px rgba(99, 102, 241, 0.35)',
            }}
          >
            <Radio size={24} color="#ffffff" />
          </div>
          <span style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Nexa<span style={{ color: 'var(--nv-cyan, #06b6d4)' }}>Voice</span>
          </span>
        </div>

        {/* Centered Form Card Container */}
        <div
          style={{
            width: '100%',
            maxWidth: '440px',
            background: 'var(--nv-bg-surface, #0f172a)',
            borderRadius: '20px',
            padding: '36px 32px',
            border: '1px solid var(--nv-border, #1e293b)',
            boxShadow:
              theme === 'dark'
                ? '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05)'
                : '0 20px 40px -15px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.05)',
            transition: 'background-color 200ms ease, border-color 200ms ease',
          }}
        >
          {(title || subtitle) && (
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              {title && (
                <h1
                  style={{
                    fontSize: '22px',
                    fontWeight: 700,
                    margin: '0 0 6px',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {title}
                </h1>
              )}
              {subtitle && (
                <p
                  style={{
                    color: 'var(--nv-text-secondary, #94a3b8)',
                    fontSize: '13.5px',
                    margin: 0,
                    lineHeight: 1.45,
                  }}
                >
                  {subtitle}
                </p>
              )}
            </div>
          )}

          {children}
        </div>
      </main>

      {/* Embedded CSS for Responsive Breakpoint behavior */}
      <style>{`
        @media (max-width: 900px) {
          .auth-brand-pane {
            display: none !important;
          }
          .auth-mobile-header {
            display: flex !important;
          }
        }
      `}</style>
    </div>
  );
}
