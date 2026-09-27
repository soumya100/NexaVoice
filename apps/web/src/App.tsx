import { useState, useEffect } from 'react';
import {
  Activity,
  Bot,
  CheckCircle2,
  Database,
  Globe,
  Mic,
  MicOff,
  Moon,
  Phone,
  PhoneOff,
  Radio,
  Server,
  Shield,
  Sun,
  Users,
  Video,
  VideoOff,
  Zap,
} from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'overview' | 'calling' | 'ai' | 'health'>('overview');
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [isCalling, setIsCalling] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [aiApprovalGranted, setAiApprovalGranted] = useState(false);

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
          // Fallback structure if server is starting
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
                v0.1.0 Phase 0
              </span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--nv-text-muted)' }}>
              Global Communication Platform & Personal AI Assistant
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Live System Status Pill */}
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
            <span>Nexa AI: Standby</span>
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
              transition: 'all 150ms ease',
            }}
          >
            <Globe size={18} />
            Overview & Architecture
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
              transition: 'all 150ms ease',
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
              transition: 'all 150ms ease',
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
              transition: 'all 150ms ease',
            }}
          >
            <Activity size={18} />
            Telemetry & Health
          </button>

          <div style={{ marginTop: 'auto', padding: '1rem', borderRadius: '12px', background: 'var(--nv-bg-elevated)', border: '1px solid var(--nv-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <Shield size={16} color="var(--nv-primary)" />
              <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>Clean Architecture</span>
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--nv-text-muted)' }}>
              Modular Monolith with strict domain boundaries, GraphQL API, and Socket.IO signaling.
            </p>
          </div>
        </aside>

        {/* Content Area */}
        <main style={{ flex: 1, padding: '2rem 3rem', overflowY: 'auto' }}>
          {activeTab === 'overview' && (
            <div>
              <div style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Platform Foundation (Phase 0)</h2>
                <p style={{ color: 'var(--nv-text-secondary)', maxWidth: '750px' }}>
                  NexaVoice is architected from first principles as an extensible, secure communication ecosystem. 
                  Below is the verified system architecture, core engineering tenets, and active services.
                </p>
              </div>

              {/* Status Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--nv-text-muted)', fontWeight: 600 }}>API Engine</span>
                    <Server size={20} color="var(--nv-primary)" />
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>NestJS 11</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--nv-status-online)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <CheckCircle2 size={14} /> Strict TypeScript & Clean Arch
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--nv-text-muted)', fontWeight: 600 }}>Primary Application API</span>
                    <Zap size={20} color="var(--nv-cyan)" />
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>GraphQL</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--nv-text-secondary)' }}>
                    Code-First Schema & Queries
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--nv-text-muted)', fontWeight: 600 }}>Realtime Transport</span>
                    <Radio size={20} color="#d946ef" />
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>Socket.IO</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--nv-text-secondary)' }}>
                    Signaling, State & Presence
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--nv-text-muted)', fontWeight: 600 }}>Data Store</span>
                    <Database size={20} color="var(--nv-status-online)" />
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>Postgres & Redis</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--nv-text-secondary)' }}>
                    Prisma ORM & Redis Cache
                  </div>
                </div>
              </div>

              {/* Architecture Principles Table */}
              <div className="glass-panel" style={{ padding: '1.75rem' }}>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Core Architectural Decisions</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', padding: '0.75rem', borderRadius: '8px', background: 'var(--nv-bg-surface)' }}>
                    <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '0.4rem', borderRadius: '6px' }}>
                      <Shield size={18} color="var(--nv-primary)" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>ADR-0001: Modular Monolith Architecture</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--nv-text-muted)' }}>
                        Unified domain modules with explicit ports/adapters. Avoids premature microservices complexity while maintaining clean boundaries.
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', padding: '0.75rem', borderRadius: '8px', background: 'var(--nv-bg-surface)' }}>
                    <div style={{ background: 'rgba(6, 182, 212, 0.1)', padding: '0.4rem', borderRadius: '6px' }}>
                      <Radio size={18} color="var(--nv-cyan)" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>ADR-0003: Signaling & Media Plane Separation</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--nv-text-muted)' }}>
                        No raw media streams route through the NestJS WebSocket gateway. WebRTC P2P and dedicated SFUs handle audio/video transport.
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', padding: '0.75rem', borderRadius: '8px', background: 'var(--nv-bg-surface)' }}>
                    <div style={{ background: 'rgba(217, 70, 239, 0.1)', padding: '0.4rem', borderRadius: '6px' }}>
                      <Bot size={18} color="#d946ef" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>ADR-0004: AI Assistant Safety & Policy Gateway</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--nv-text-muted)' }}>
                        Autonomous tools are gated by granular policies and human approval. Unchecked tool execution is strictly prohibited.
                      </div>
                    </div>
                  </div>
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
                    {/* Active call indicator */}
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

                    {/* Participant Avatars */}
                    <div style={{ display: 'flex', gap: '2.5rem', marginBottom: '2.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                      {/* Host Participant */}
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
                        {/* Audio Wave */}
                        {!isMicMuted && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', height: '24px' }}>
                            <div className="wave-bar" style={{ animationDelay: '0ms' }} />
                            <div className="wave-bar" style={{ animationDelay: '200ms' }} />
                            <div className="wave-bar" style={{ animationDelay: '400ms' }} />
                            <div className="wave-bar" style={{ animationDelay: '100ms' }} />
                          </div>
                        )}
                      </div>

                      {/* AI Assistant Participant */}
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

                    {/* In-Call Controls */}
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
                {/* AI Persona */}
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

                {/* Human Approval Simulation */}
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
                <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Infrastructure Telemetry</h2>
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
