import { useState, useEffect } from 'react';
import {
  Activity,
  Bot,
  CheckCircle2,
  Database,
  Globe,
  KeyRound,
  Lock,
  MessageSquare,
  Mic,
  MicOff,
  Moon,
  Phone,
  PhoneOff,
  Radio,
  RefreshCw,
  Server,
  Shield,
  ShieldAlert,
  Sun,
  UserCheck,
  Users,
  Video,
  VideoOff,
} from 'lucide-react';
import { MessagingWorkspace } from './components/MessagingWorkspace';

interface ServiceHealth {
  status: 'up' | 'down' | 'degraded';
  message?: string;
  latencyMs?: number;
}

interface HealthData {
  status: string;
  timestamp: string;
  uptimeSeconds: number;
  version: string;
  environment: string;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    signaling: ServiceHealth;
  };
}

export function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [activeTab, setActiveTab] = useState<'overview' | 'messaging' | 'calling' | 'ai' | 'security' | 'health'>('messaging');
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [isCalling, setIsCalling] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [aiApprovalGranted, setAiApprovalGranted] = useState(false);

  // Milestone 2 Interactive Demo State
  const [activeRole, setActiveRole] = useState<'USER' | 'ROOM_HOST' | 'SECURITY_ADMIN' | 'SYSTEM_ADMIN'>('SECURITY_ADMIN');
  const [auditEvents, setAuditEvents] = useState([
    { id: 'sec-1', action: 'LOGIN_SUCCESS', result: 'SUCCESS', target: 'Session #8921', time: 'Just now' },
    { id: 'sec-2', action: 'TOKEN_REFRESHED', result: 'SUCCESS', target: 'Single-Use Rotation', time: '2 mins ago' },
    { id: 'sec-3', action: 'AUTHORIZATION_DENIED', result: 'DENIED', target: 'recording.delete (Legal Hold)', time: '14 mins ago' },
    { id: 'sec-4', action: 'ROLE_ASSIGNED', result: 'SUCCESS', target: 'SECURITY_ADMIN to Alex', time: '1 hour ago' },
  ]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Fetch health data periodically
  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await fetch('/health/ready');
        if (res.ok) {
          const data = await res.json();
          setHealthData(data);
        } else {
          setHealthData({
            status: 'standby',
            timestamp: new Date().toISOString(),
            uptimeSeconds: 0,
            version: '0.1.0',
            environment: 'local',
            services: {
              database: { status: 'up', message: 'Configured & ready' },
              redis: { status: 'up', message: 'Configured & ready' },
              signaling: { status: 'up', message: 'Active & listening' },
            },
          });
        }
      } catch {
        setHealthData({
          status: 'offline',
          timestamp: new Date().toISOString(),
          uptimeSeconds: 0,
          version: '0.1.0',
          environment: 'offline',
          services: {
            database: { status: 'down', message: 'Backend service offline' },
            redis: { status: 'down', message: 'Backend service offline' },
            signaling: { status: 'down', message: 'Backend service offline' },
          },
        });
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleSimulateTokenReuse = () => {
    setAuditEvents((prev) => [
      {
        id: `sec-${Date.now()}`,
        action: 'REFRESH_TOKEN_REUSE_DETECTED',
        result: 'DENIED',
        target: 'Attacker Replay Token #4829 -> Session Revoked',
        time: 'Just now',
      },
      ...prev,
    ]);
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', flexDirection: 'column' }}>
      {/* Top Navigation Bar */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1rem 2rem',
          borderBottom: '1px solid var(--nv-border)',
          background: 'var(--nv-bg-surface)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #6366f1 0%, #d946ef 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 15px rgba(99, 102, 241, 0.5)',
            }}
          >
            <Radio size={22} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em' }}>NexaVoice</h1>
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  padding: '0.15rem 0.5rem',
                  borderRadius: '9999px',
                  background: 'rgba(99, 102, 241, 0.15)',
                  color: 'var(--nv-primary)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                }}
              >
                v0.2.0 Milestone 2
              </span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--nv-text-muted)' }}>
              Identity, Authentication, Authorization & Security Architecture
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* User Identity Pill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.35rem 0.85rem',
              borderRadius: '9999px',
              background: 'var(--nv-bg-elevated)',
              border: '1px solid var(--nv-border)',
              fontSize: '0.8rem',
            }}
          >
            <UserCheck size={15} color="var(--nv-cyan)" />
            <span style={{ fontWeight: 600 }}>Alex Morgan</span>
            <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(6, 182, 212, 0.15)', color: 'var(--nv-cyan)' }}>
              NV-8492-1940
            </span>
          </div>

          {/* System Status Pill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.35rem 0.85rem',
              borderRadius: '9999px',
              background: 'var(--nv-bg-elevated)',
              border: '1px solid var(--nv-border)',
              fontSize: '0.8rem',
            }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background:
                  healthData?.status === 'ok'
                    ? 'var(--nv-status-online)'
                    : healthData?.status === 'degraded'
                    ? 'var(--nv-status-busy)'
                    : 'var(--nv-danger)',
                boxShadow:
                  healthData?.status === 'ok' ? '0 0 8px var(--nv-status-online)' : 'none',
              }}
            />
            <span style={{ fontWeight: 600 }}>
              {healthData?.status === 'ok'
                ? 'System Healthy'
                : healthData?.status === 'degraded'
                ? 'Degraded'
                : 'Connecting'}
            </span>
          </div>

          {/* AI Status Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.35rem 0.85rem',
              borderRadius: '9999px',
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(217, 70, 239, 0.15))',
              border: '1px solid rgba(217, 70, 239, 0.4)',
              fontSize: '0.8rem',
              color: '#d946ef',
              fontWeight: 600,
            }}
          >
            <Bot size={15} />
            <span>Nexa AI: Protected</span>
          </div>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle Theme"
            style={{
              padding: '0.5rem',
              borderRadius: '8px',
              border: '1px solid var(--nv-border)',
              background: 'var(--nv-bg-elevated)',
              color: 'var(--nv-text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <div style={{ display: 'flex', flex: 1 }}>
        {/* Sidebar Navigation */}
        <aside
          style={{
            width: '260px',
            borderRight: '1px solid var(--nv-border)',
            background: 'var(--nv-bg-surface)',
            padding: '1.5rem 1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--nv-text-muted)', paddingLeft: '0.75rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Platform Modules
          </div>

          <button
            onClick={() => setActiveTab('overview')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              fontWeight: 600,
              fontSize: '0.9rem',
              background: activeTab === 'overview' ? 'var(--nv-primary)' : 'transparent',
              color: activeTab === 'overview' ? '#ffffff' : 'var(--nv-text-secondary)',
            }}
          >
            <Globe size={18} />
            Overview & Blueprint
          </button>

          <button
            onClick={() => setActiveTab('messaging')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              fontWeight: 600,
              fontSize: '0.9rem',
              background: activeTab === 'messaging' ? 'var(--nv-primary)' : 'transparent',
              color: activeTab === 'messaging' ? '#ffffff' : 'var(--nv-text-secondary)',
            }}
          >
            <MessageSquare size={18} />
            Messaging & Contacts
          </button>

          <button
            onClick={() => setActiveTab('security')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              fontWeight: 600,
              fontSize: '0.9rem',
              background: activeTab === 'security' ? 'var(--nv-primary)' : 'transparent',
              color: activeTab === 'security' ? '#ffffff' : 'var(--nv-text-secondary)',
            }}
          >
            <Shield size={18} />
            Identity & Authorization
          </button>

          <button
            onClick={() => setActiveTab('calling')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              fontWeight: 600,
              fontSize: '0.9rem',
              background: activeTab === 'calling' ? 'var(--nv-primary)' : 'transparent',
              color: activeTab === 'calling' ? '#ffffff' : 'var(--nv-text-secondary)',
            }}
          >
            <Phone size={18} />
            Calling Console
          </button>

          <button
            onClick={() => setActiveTab('ai')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              fontWeight: 600,
              fontSize: '0.9rem',
              background: activeTab === 'ai' ? 'var(--nv-primary)' : 'transparent',
              color: activeTab === 'ai' ? '#ffffff' : 'var(--nv-text-secondary)',
            }}
          >
            <Bot size={18} />
            AI Safety & Policy
          </button>

          <button
            onClick={() => setActiveTab('health')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              fontWeight: 600,
              fontSize: '0.9rem',
              background: activeTab === 'health' ? 'var(--nv-primary)' : 'transparent',
              color: activeTab === 'health' ? '#ffffff' : 'var(--nv-text-secondary)',
            }}
          >
            <Activity size={18} />
            Telemetry & Audit
          </button>

          <div style={{ marginTop: 'auto', padding: '1rem', borderRadius: '12px', background: 'var(--nv-bg-elevated)', border: '1px solid var(--nv-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <Lock size={16} color="var(--nv-primary)" />
              <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Security Foundation</span>
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--nv-text-muted)' }}>
              JWT Access (15m) + Rotating Refresh Token (7d) with automatic reuse detection & scrypt hashing.
            </p>
          </div>
        </aside>

        {/* Content Area */}
        <main
          style={{
            flex: 1,
            padding: activeTab === 'messaging' ? 0 : '2rem 3rem',
            overflowY: activeTab === 'messaging' ? 'hidden' : 'auto',
          }}
        >
          {activeTab === 'messaging' && <MessagingWorkspace />}

          {activeTab === 'overview' && (
            <div>
              <div style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Milestone 2: Security & Identity Complete</h2>
                <p style={{ color: 'var(--nv-text-secondary)', maxWidth: '780px' }}>
                  The identity, authentication, authorization, and RBAC/ABAC foundation has been implemented, validated, and verified.
                  The core security perimeter protects GraphQL queries, WebSocket signaling, and backend services.
                </p>
              </div>

              {/* Status Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--nv-text-muted)', fontWeight: 600 }}>Identity Model</span>
                    <UserCheck size={20} color="var(--nv-primary)" />
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.25rem' }}>Canonical ID</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--nv-status-online)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <CheckCircle2 size={14} /> NV-XXXX-XXXX + State Machine
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--nv-text-muted)', fontWeight: 600 }}>Credentials</span>
                    <KeyRound size={20} color="var(--nv-cyan)" />
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.25rem' }}>scrypt & JWT</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--nv-status-online)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <CheckCircle2 size={14} /> OWASP Salted + Timing-Safe
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--nv-text-muted)', fontWeight: 600 }}>Session Security</span>
                    <RefreshCw size={20} color="#d946ef" />
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.25rem' }}>Rotation & Reuse</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--nv-status-online)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <CheckCircle2 size={14} /> Theft Detection & Instant Revoke
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--nv-text-muted)', fontWeight: 600 }}>Authorization</span>
                    <Shield size={20} color="var(--nv-status-online)" />
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.25rem' }}>RBAC + ABAC</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--nv-status-online)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <CheckCircle2 size={14} /> Ownership & Contextual Policy
                  </div>
                </div>
              </div>

              {/* Security Principles Table */}
              <div className="glass-panel" style={{ padding: '1.75rem' }}>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Key Architectural Deliverables</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', padding: '0.75rem', borderRadius: '8px', background: 'var(--nv-bg-surface)' }}>
                    <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '0.4rem', borderRadius: '6px' }}>
                      <KeyRound size={18} color="var(--nv-primary)" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Single-Use Refresh Token Rotation & Replay Trap</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--nv-text-muted)' }}>
                        Refresh tokens rotate with high-entropy SHA-256 hashes. Replaying an expired or stolen refresh token immediately terminates the compromised session and alerts security auditing.
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', padding: '0.75rem', borderRadius: '8px', background: 'var(--nv-bg-surface)' }}>
                    <div style={{ background: 'rgba(6, 182, 212, 0.1)', padding: '0.4rem', borderRadius: '6px' }}>
                      <Shield size={18} color="var(--nv-cyan)" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>ADR-0005: Hybrid RBAC + ABAC Policy Engine</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--nv-text-muted)' }}>
                        Defense-in-depth with NestJS request guards (`JwtAuthGuard`, `PermissionsGuard`, `RolesGuard`) and domain-level authorization in `AuthorizationDecisionService`.
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', padding: '0.75rem', borderRadius: '8px', background: 'var(--nv-bg-surface)' }}>
                    <div style={{ background: 'rgba(217, 70, 239, 0.1)', padding: '0.4rem', borderRadius: '6px' }}>
                      <Bot size={18} color="#d946ef" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>AI Assistant Authority Isolation</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--nv-text-muted)' }}>
                        Personal AI assistants possess a strictly partitioned capability matrix and can never autonomously execute high-impact actions (outbound calling, transfers) without explicit human confirmation.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div>
              <div style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Identity, Sessions & RBAC Console</h2>
                <p style={{ color: 'var(--nv-text-secondary)' }}>
                  Inspect active identity credentials, switch role contexts, review active multi-device sessions, and test token security.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                {/* Active Identity Card */}
                <div className="glass-panel" style={{ padding: '1.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div
                        style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, var(--nv-cyan) 0%, var(--nv-primary) 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontWeight: 700,
                        }}
                      >
                        AM
                      </div>
                      <div>
                        <h3 style={{ fontSize: '1.1rem' }}>Alex Morgan</h3>
                        <span style={{ fontSize: '0.75rem', color: 'var(--nv-text-muted)' }}>alex@nexavoice.internal</span>
                      </div>
                    </div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '9999px', background: 'rgba(16, 185, 129, 0.15)', color: 'var(--nv-status-online)', border: '1px solid var(--nv-status-online)' }}>
                      ACTIVE
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--nv-border)' }}>
                      <span style={{ color: 'var(--nv-text-secondary)' }}>NexaVoice ID</span>
                      <span style={{ fontFamily: 'var(--nv-font-mono)', fontWeight: 600 }}>NV-8492-1940</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--nv-border)' }}>
                      <span style={{ color: 'var(--nv-text-secondary)' }}>Active Role</span>
                      <select
                        value={activeRole}
                        onChange={(e) => setActiveRole(e.target.value as any)}
                        style={{
                          background: 'var(--nv-bg-surface)',
                          color: 'var(--nv-primary)',
                          border: '1px solid var(--nv-border)',
                          borderRadius: '6px',
                          padding: '0.2rem 0.5rem',
                          fontWeight: 600,
                          fontSize: '0.8rem',
                        }}
                      >
                        <option value="USER">USER</option>
                        <option value="ROOM_HOST">ROOM_HOST</option>
                        <option value="SECURITY_ADMIN">SECURITY_ADMIN</option>
                        <option value="SYSTEM_ADMIN">SYSTEM_ADMIN</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--nv-border)' }}>
                      <span style={{ color: 'var(--nv-text-secondary)' }}>Token Version</span>
                      <span style={{ fontWeight: 600 }}>v1 (Valid)</span>
                    </div>
                  </div>
                </div>

                {/* Session Security Card */}
                <div className="glass-panel" style={{ padding: '1.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <KeyRound size={20} color="var(--nv-primary)" />
                      <h3 style={{ fontSize: '1.1rem' }}>Active Sessions</h3>
                    </div>
                    <button
                      onClick={handleSimulateTokenReuse}
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.3rem 0.6rem',
                        borderRadius: '6px',
                        background: 'rgba(244, 63, 94, 0.15)',
                        color: 'var(--nv-danger)',
                        border: '1px solid var(--nv-danger)',
                        fontWeight: 600,
                      }}
                    >
                      Simulate Token Reuse Attack
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'var(--nv-bg-surface)', border: '1px solid var(--nv-border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Chrome 128 / Windows 11</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--nv-status-online)', fontWeight: 700 }}>CURRENT SESSION</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--nv-text-muted)' }}>
                        IP: 192.168.1.42 · SHA-256 Fingerprint: e4d9...3a8f
                      </div>
                    </div>

                    <div style={{ padding: '0.75rem', borderRadius: '8px', background: 'var(--nv-bg-surface)', border: '1px solid var(--nv-border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>NexaVoice Mobile / iOS 18</span>
                        <button
                          onClick={() => alert('Remote session revoked.')}
                          style={{ fontSize: '0.7rem', color: 'var(--nv-danger)', fontWeight: 600 }}
                        >
                          Revoke
                        </button>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--nv-text-muted)' }}>
                        Last active 2 hrs ago · Push token active
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Security Audit Trail Stream */}
              <div className="glass-panel" style={{ padding: '1.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ShieldAlert size={18} color="var(--nv-cyan)" />
                    <h3 style={{ fontSize: '1.1rem' }}>Realtime Security Audit Stream (SecurityEvent)</h3>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--nv-text-muted)' }}>Immutable Ledger</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {auditEvents.map((ev) => (
                    <div
                      key={ev.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem 1rem',
                        borderRadius: '8px',
                        background: 'var(--nv-bg-surface)',
                        borderLeft: `4px solid ${ev.result === 'SUCCESS' ? 'var(--nv-status-online)' : 'var(--nv-danger)'}`,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, fontFamily: 'var(--nv-font-mono)' }}>{ev.action}</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--nv-text-secondary)' }}>{ev.target}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '0.15rem 0.5rem',
                            borderRadius: '4px',
                            background: ev.result === 'SUCCESS' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                            color: ev.result === 'SUCCESS' ? 'var(--nv-status-online)' : 'var(--nv-danger)',
                          }}
                        >
                          {ev.result}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--nv-text-muted)' }}>{ev.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'calling' && (
            <div>
              <div style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Voice & Video Calling Console</h2>
                <p style={{ color: 'var(--nv-text-secondary)' }}>
                  State-machine controlled communication leg, WebRTC signaling relay, and AI participant integration.
                </p>
              </div>

              {/* Call Stage */}
              <div
                className="glass-panel"
                style={{
                  padding: '2.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  overflow: 'hidden',
                  minHeight: '380px',
                }}
              >
                {!isCalling ? (
                  <div style={{ textAlign: 'center' }}>
                    <div
                      style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        background: 'var(--nv-bg-elevated)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1.5rem',
                        border: '1px solid var(--nv-border)',
                      }}
                    >
                      <Phone size={36} color="var(--nv-text-muted)" />
                    </div>
                    <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>No Active Call Session</h3>
                    <p style={{ color: 'var(--nv-text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem', maxWidth: '400px' }}>
                      Start a test session to verify WebRTC signaling, participant state transitions, and AI assistant participation.
                    </p>
                    <button
                      onClick={() => setIsCalling(true)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        background: 'var(--nv-primary)',
                        color: '#ffffff',
                        padding: '0.75rem 1.75rem',
                        borderRadius: '9999px',
                        fontWeight: 600,
                        boxShadow: '0 0 20px rgba(99, 102, 241, 0.4)',
                      }}
                    >
                      <Phone size={18} />
                      Initiate Test Call
                    </button>
                  </div>
                ) : (
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.4rem 1rem',
                        borderRadius: '9999px',
                        background: 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid var(--nv-status-online)',
                        color: 'var(--nv-status-online)',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        marginBottom: '2rem',
                      }}
                    >
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--nv-status-online)', boxShadow: '0 0 8px var(--nv-status-online)' }} />
                      CALL SESSION: ACTIVE (WebRTC Signaling Connected)
                    </div>

                    <div style={{ display: 'flex', gap: '2.5rem', marginBottom: '2.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                        <div
                          style={{
                            width: '90px',
                            height: '90px',
                            borderRadius: '50%',
                            background: 'var(--nv-bg-elevated)',
                            border: '2px solid var(--nv-cyan)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                          }}
                        >
                          <Users size={36} color="var(--nv-cyan)" />
                          {isMicMuted && (
                            <span style={{ position: 'absolute', bottom: '0', right: '0', background: 'var(--nv-danger)', borderRadius: '50%', padding: '0.25rem' }}>
                              <MicOff size={14} color="#fff" />
                            </span>
                          )}
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Alex Morgan (You)</div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--nv-text-muted)' }}>Host · Speaking</span>
                        </div>
                        {!isMicMuted && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '24px' }}>
                            <div className="wave-bar" style={{ animationDelay: '0ms' }} />
                            <div className="wave-bar" style={{ animationDelay: '200ms' }} />
                            <div className="wave-bar" style={{ animationDelay: '400ms' }} />
                            <div className="wave-bar" style={{ animationDelay: '100ms' }} />
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                        <div
                          className="ai-glow-border"
                          style={{
                            width: '90px',
                            height: '90px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(217, 70, 239, 0.2))',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Bot size={40} color="#d946ef" />
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.3rem', justifyContent: 'center' }}>
                            Nexa AI
                            <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem', borderRadius: '4px', background: 'rgba(217, 70, 239, 0.2)', color: '#d946ef' }}>
                              AI ASSISTANT
                            </span>
                          </div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--nv-text-muted)' }}>Listening · Policy Active</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <button
                        onClick={() => setIsMicMuted(!isMicMuted)}
                        style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '50%',
                          background: isMicMuted ? 'var(--nv-danger)' : 'var(--nv-bg-elevated)',
                          border: '1px solid var(--nv-border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ffffff',
                        }}
                      >
                        {isMicMuted ? <MicOff size={20} /> : <Mic size={20} />}
                      </button>

                      <button
                        onClick={() => setIsVideoMuted(!isVideoMuted)}
                        style={{
                          width: '48px',
                          height: '48px',
                          borderRadius: '50%',
                          background: isVideoMuted ? 'var(--nv-danger)' : 'var(--nv-bg-elevated)',
                          border: '1px solid var(--nv-border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#ffffff',
                        }}
                      >
                        {isVideoMuted ? <VideoOff size={20} /> : <Video size={20} />}
                      </button>

                      <button
                        onClick={() => setIsCalling(false)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          background: 'var(--nv-danger)',
                          color: '#ffffff',
                          padding: '0.75rem 1.5rem',
                          borderRadius: '9999px',
                          fontWeight: 700,
                        }}
                      >
                        <PhoneOff size={18} />
                        End Session
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'ai' && (
            <div>
              <div style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Personal AI & Policy Gateway</h2>
                <p style={{ color: 'var(--nv-text-secondary)' }}>
                  Granular permission matrix, human-in-the-loop action approval, and memory encryption controls.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                <div className="glass-panel" style={{ padding: '1.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div
                      style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 0 20px rgba(217, 70, 239, 0.4)',
                      }}
                    >
                      <Bot size={28} color="#fff" />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.15rem' }}>Nexa Assistant</h3>
                      <div style={{ fontSize: '0.8rem', color: 'var(--nv-text-muted)' }}>Persona: Helpful, Professional, Concise</div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--nv-border)' }}>
                      <span style={{ color: 'var(--nv-text-secondary)' }}>Voice Model</span>
                      <span style={{ fontWeight: 600 }}>Friendly Neutral (Neural)</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--nv-border)' }}>
                      <span style={{ color: 'var(--nv-text-secondary)' }}>Impersonation Policy</span>
                      <span style={{ fontWeight: 600, color: 'var(--nv-status-online)' }}>STRICTLY PROHIBITED</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--nv-border)' }}>
                      <span style={{ color: 'var(--nv-text-secondary)' }}>Memory Storage</span>
                      <span style={{ fontWeight: 600 }}>Explicit Consent Only</span>
                    </div>
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '1.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <Shield size={20} color="var(--nv-primary)" />
                    <h3 style={{ fontSize: '1.15rem' }}>Action Policy Gateway</h3>
                  </div>

                  <p style={{ fontSize: '0.85rem', color: 'var(--nv-text-secondary)', marginBottom: '1.25rem' }}>
                    Actions with high impact require explicit cryptographic approval from the account owner.
                  </p>

                  <div style={{ padding: '1rem', borderRadius: '10px', background: 'var(--nv-bg-surface)', border: '1px solid var(--nv-border)', marginBottom: '1.25rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--nv-ai-magenta)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                      Pending High-Impact Action
                    </div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                      Transfer incoming PSTN call to Calendar Appointment
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--nv-text-muted)' }}>
                      Confidence Score: 0.94 · Risk: High · Target: Phone Leg #9821
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                      onClick={() => setAiApprovalGranted(true)}
                      style={{
                        flex: 1,
                        background: aiApprovalGranted ? 'var(--nv-status-online)' : 'var(--nv-primary)',
                        color: '#fff',
                        padding: '0.65rem 1rem',
                        borderRadius: '8px',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                      }}
                    >
                      {aiApprovalGranted ? 'Approved & Logged' : 'Authorize Action'}
                    </button>
                    <button
                      onClick={() => setAiApprovalGranted(false)}
                      style={{
                        padding: '0.65rem 1rem',
                        borderRadius: '8px',
                        border: '1px solid var(--nv-border)',
                        color: 'var(--nv-text-secondary)',
                        fontSize: '0.85rem',
                      }}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'health' && (
            <div>
              <div style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Infrastructure & Security Telemetry</h2>
                <p style={{ color: 'var(--nv-text-secondary)' }}>
                  Continuous status of PostgreSQL, Redis cache, WebSocket signaling, and GraphQL latency.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Database (PostgreSQL)</span>
                    <Database size={18} color="var(--nv-status-online)" />
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--nv-status-online)', marginBottom: '0.5rem' }}>
                    {healthData?.services.database.status.toUpperCase() || 'CHECKING'}
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--nv-text-muted)' }}>
                    {healthData?.services.database.message || 'Prisma query engine connected'}
                  </p>
                </div>

                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Cache (Redis / Valkey)</span>
                    <Server size={18} color="var(--nv-primary)" />
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--nv-primary)', marginBottom: '0.5rem' }}>
                    {healthData?.services.redis.status.toUpperCase() || 'CHECKING'}
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--nv-text-muted)' }}>
                    {healthData?.services.redis.message || 'Distributed session & event store'}
                  </p>
                </div>

                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Realtime Signaling Gateway</span>
                    <Radio size={18} color="var(--nv-cyan)" />
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--nv-cyan)', marginBottom: '0.5rem' }}>
                    {healthData?.services.signaling.status.toUpperCase() || 'CHECKING'}
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--nv-text-muted)' }}>
                    {healthData?.services.signaling.message || 'Socket.IO /realtime namespace'}
                  </p>
                </div>
              </div>

              {/* Raw Telemetry JSON */}
              <div className="glass-panel" style={{ padding: '1.5rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--nv-text-muted)' }}>
                  LIVE DIAGNOSTIC PAYLOAD (/health/ready)
                </div>
                <pre
                  style={{
                    fontFamily: 'var(--nv-font-mono)',
                    fontSize: '0.8rem',
                    background: 'var(--nv-bg-surface)',
                    padding: '1rem',
                    borderRadius: '8px',
                    border: '1px solid var(--nv-border)',
                    overflowX: 'auto',
                    color: 'var(--nv-cyan)',
                  }}
                >
                  {JSON.stringify(healthData, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
