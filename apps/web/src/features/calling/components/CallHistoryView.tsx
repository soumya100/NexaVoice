import React, { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useActiveCallsQuery, useCallHistoryQuery, useInitiateCallMutation } from '../hooks/use-call-queries';
import { CallType, CallSessionStatus } from '@nexavoice/domain-types';
import { formatDuration } from './ActiveCallView';
import { callKeys } from '../../../query/query-keys';
import { toastService } from '../../../services/toast';
import {
  Phone,
  PhoneCall,
  Video,
  Plus,
  Search,
  Users,
  Clock,
  Copy,
  Check,
  Radio,
  Signal,
  Sparkles,
  RefreshCw,
  ArrowUpRight,
  Shield,
  Layers,
  PhoneOff,
  X,
  Zap,
  Volume2,
} from 'lucide-react';

interface CallHistoryViewProps {
  onJoinCall: (callId: string) => void;
}

export const CallHistoryView: React.FC<CallHistoryViewProps> = ({ onJoinCall }) => {
  const queryClient = useQueryClient();
  const { data: activeCalls, isLoading: activeLoading, isRefetching: activeRefetching } = useActiveCallsQuery();
  const { data: callHistory, isLoading: historyLoading } = useCallHistoryQuery(50, 0);
  const initiateMutation = useInitiateCallMutation();

  // Search, filter, and modal states
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'VOICE' | 'VIDEO' | 'ENDED' | 'MISSED'>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customRoomName, setCustomRoomName] = useState('');
  const [customCallType, setCustomCallType] = useState<CallType>(CallType.VIDEO);
  const [quickJoinId, setQuickJoinId] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Manual refresh of telemetry & frequencies
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: callKeys.active() }),
        queryClient.invalidateQueries({ queryKey: callKeys.history() }),
      ]);
      toastService.info('All call frequencies & telemetry refreshed.');
    } catch {
      toastService.error('Failed to refresh call telemetry.');
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // Launch instant calls
  const handleStartCall = async (type: CallType, name?: string) => {
    const isVideo = type === CallType.VIDEO || type === CallType.GROUP_VIDEO;
    const roomTitle = name?.trim() || (isVideo ? 'HD Video Conference' : 'Encrypted Voice Room');

    toastService.info(
      isVideo
        ? 'Allocating SFU video channels & peer mesh...'
        : 'Initializing encrypted 48kHz audio pipeline...',
    );

    try {
      const call = await initiateMutation.mutateAsync({
        callType: type,
        inviteeUserIds: [],
        roomName: roomTitle,
      });

      toastService.success(
        isVideo
          ? 'HD Video conference live! Connecting you now...'
          : 'Voice room established! Connecting audio pipeline...',
      );

      onJoinCall(call.id);
    } catch (err: any) {
      console.error('Failed to initiate instant call', err);
      toastService.error(err?.message || 'Failed to initiate call session. Verify network connection.');
    }
  };

  // Create custom room
  const handleCreateCustomRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customRoomName.trim()) {
      toastService.warning('Please enter a room name before launching.');
      return;
    }

    const roomTitle = customRoomName.trim();
    toastService.info(`Deploying room "${roomTitle}"...`);

    try {
      const call = await initiateMutation.mutateAsync({
        callType: customCallType,
        inviteeUserIds: [],
        roomName: roomTitle,
      });

      toastService.success(`Room "${roomTitle}" deployed with extreme prejudice! Jumping in...`);
      setIsModalOpen(false);
      setCustomRoomName('');
      onJoinCall(call.id);
    } catch (err: any) {
      console.error('Failed to create custom room', err);
      toastService.error(err?.message || 'Failed to deploy custom room.');
    }
  };

  // Quick frequency join by Call ID / Room code
  const handleQuickJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = quickJoinId.trim().replace(/^.*\/app\/calls\//, '');
    if (!cleanId) {
      toastService.warning('Please enter a valid Call ID or room link.');
      return;
    }

    toastService.success(`Frequency locked! Warping into session ${cleanId.slice(0, 8)}...`);
    onJoinCall(cleanId);
    setQuickJoinId('');
  };

  // Copy link / ID with sassy toast
  const handleCopyLink = async (callId: string, roomName?: string) => {
    try {
      const link = `${window.location.origin}/app/calls/${callId}`;
      await navigator.clipboard.writeText(link);
      setCopiedId(callId);
      setTimeout(() => setCopiedId(null), 2500);
      toastService.success(
        roomName
          ? `Invite link for "${roomName}" copied! Drop it in chat and summon the crew.`
          : 'Meeting link copied to clipboard! Drop it in chat and summon the crew.',
      );
    } catch {
      toastService.error('Failed to copy link to clipboard.');
    }
  };

  // Filtered Call History
  const filteredHistory = useMemo(() => {
    if (!callHistory) return [];
    return callHistory.filter((call) => {
      // Tab filter
      if (activeTab === 'VOICE' && !(call.callType === CallType.VOICE || call.callType === CallType.GROUP_VOICE)) {
        return false;
      }
      if (activeTab === 'VIDEO' && !(call.callType === CallType.VIDEO || call.callType === CallType.GROUP_VIDEO || call.callType === CallType.CONFERENCE)) {
        return false;
      }
      if (activeTab === 'ENDED' && call.status !== CallSessionStatus.ENDED) {
        return false;
      }
      if (activeTab === 'MISSED' && !(call.status === CallSessionStatus.MISSED || call.status === CallSessionStatus.FAILED || call.status === CallSessionStatus.REJECTED)) {
        return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const roomMatch = call.roomName?.toLowerCase().includes(query);
        const idMatch = call.id.toLowerCase().includes(query);
        const participantMatch = call.participants?.some(p => p.displayName?.toLowerCase().includes(query));
        return roomMatch || idMatch || participantMatch;
      }

      return true;
    });
  }, [callHistory, activeTab, searchQuery]);

  const activeCount = activeCalls?.length || 0;
  const historyCount = callHistory?.length || 0;

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#090d16',
        color: '#f8fafc',
        padding: '28px 36px',
        overflowY: 'auto',
        fontFamily: 'var(--nv-font-sans)',
      }}
    >
      {/* =========================================================================
          1. HEADER & LIVE TELEMETRY DASHBOARD
          ========================================================================= */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          paddingBottom: '24px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h1
                style={{
                  fontSize: '28px',
                  fontWeight: 800,
                  letterSpacing: '-0.03em',
                  background: 'linear-gradient(135deg, #ffffff 40%, #a5b4fc 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  margin: 0,
                }}
              >
                NexaVoice Calling Studio
              </h1>
              <span
                style={{
                  padding: '3px 10px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  backgroundColor: 'rgba(99, 102, 241, 0.15)',
                  color: '#818cf8',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  textTransform: 'uppercase',
                }}
              >
                SFU Mesh Engine
              </span>
            </div>
            <p
              style={{
                fontSize: '14px',
                color: '#94a3b8',
                marginTop: '6px',
                maxWidth: '680px',
                lineHeight: 1.5,
              }}
            >
              Crystal-clear communications without the telecom nonsense. 48kHz Opus HD audio, ultra-low latency WebRTC mesh, and quantum-resistant DTLS-SRTP encryption. Say it loud, say it proud.
            </p>
          </div>

          {/* Quick Refresh Telemetry Button */}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing || activeRefetching}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 16px',
              borderRadius: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#cbd5e1',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 200ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            }}
          >
            <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync Frequencies'}</span>
          </button>
        </div>

        {/* Real-time Telemetry Badges Strip */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          {/* Active Calls Badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: '10px',
              backgroundColor: activeCount > 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(23, 32, 51, 0.8)',
              border: activeCount > 0 ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255, 255, 255, 0.06)',
              fontSize: '12px',
              fontWeight: 600,
              color: activeCount > 0 ? '#34d399' : '#94a3b8',
            }}
          >
            {activeCount > 0 ? (
              <span className="live-beacon" />
            ) : (
              <Radio size={14} color="#64748b" />
            )}
            <span>
              {activeCount > 0 ? `${activeCount} Live Session${activeCount > 1 ? 's' : ''}` : 'No Active Transmissions'}
            </span>
          </div>

          {/* Audio Engine */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: '10px',
              backgroundColor: 'rgba(23, 32, 51, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              fontSize: '12px',
              fontWeight: 500,
              color: '#94a3b8',
            }}
          >
            <Volume2 size={14} color="#06b6d4" />
            <span>Opus HD 48kHz Stereo</span>
          </div>

          {/* Encryption */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: '10px',
              backgroundColor: 'rgba(23, 32, 51, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              fontSize: '12px',
              fontWeight: 500,
              color: '#94a3b8',
            }}
          >
            <Shield size={14} color="#a855f7" />
            <span>DTLS-SRTP 256-Bit E2EE</span>
          </div>

          {/* Mesh status */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: '10px',
              backgroundColor: 'rgba(23, 32, 51, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              fontSize: '12px',
              fontWeight: 500,
              color: '#94a3b8',
            }}
          >
            <Signal size={14} color="#10b981" />
            <span>Zero Dropped Packets</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          2. COMMAND DECK (HERO ACTION GRID)
          ========================================================================= */}
      <div style={{ marginTop: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, letterSpacing: '-0.01em', margin: 0, color: '#f1f5f9' }}>
            Instant Communications Deck
          </h2>
          <span style={{ fontSize: '12px', color: '#64748b' }}>Ready for immediate transmission</span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '16px',
          }}
        >
          {/* Card 1: Instant Encrypted Voice Call */}
          <div
            className="calling-hero-card"
            style={{ '--card-accent': '#10b981', '--card-glow': 'rgba(16, 185, 129, 0.25)' } as React.CSSProperties}
          >
            <div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(5, 150, 105, 0.1))',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  marginBottom: '16px',
                }}
              >
                <Phone size={22} color="#34d399" />
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 6px 0', color: '#ffffff' }}>
                Instant Voice Room
              </h3>
              <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 20px 0', lineHeight: 1.4 }}>
                Studio-grade Opus voice haven. Zero camera anxiety, zero dropped syllables.
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleStartCall(CallType.VOICE)}
              disabled={initiateMutation.isPending}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                width: '100%',
                padding: '11px 16px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 200ms ease',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.45)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(16, 185, 129, 0.3)';
              }}
            >
              <PhoneCall size={16} />
              <span>{initiateMutation.isPending ? 'Connecting...' : 'Launch Voice Room'}</span>
            </button>
          </div>

          {/* Card 2: HD Video Conference */}
          <div
            className="calling-hero-card"
            style={{ '--card-accent': '#6366f1', '--card-glow': 'rgba(99, 102, 241, 0.25)' } as React.CSSProperties}
          >
            <div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(79, 70, 229, 0.1))',
                  border: '1px solid rgba(99, 102, 241, 0.35)',
                  marginBottom: '16px',
                }}
              >
                <Video size={22} color="#818cf8" />
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 6px 0', color: '#ffffff' }}>
                HD Video Conference
              </h3>
              <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 20px 0', lineHeight: 1.4 }}>
                1080p WebRTC mesh with adaptive bitrate and screen sharing. Look sharp, assert dominance.
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleStartCall(CallType.VIDEO)}
              disabled={initiateMutation.isPending}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                width: '100%',
                padding: '11px 16px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 200ms ease',
                boxShadow: '0 4px 14px rgba(99, 102, 241, 0.3)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(99, 102, 241, 0.45)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(99, 102, 241, 0.3)';
              }}
            >
              <Sparkles size={16} />
              <span>{initiateMutation.isPending ? 'Connecting...' : 'Launch Video Room'}</span>
            </button>
          </div>

          {/* Card 3: Custom Named Room */}
          <div
            className="calling-hero-card"
            style={{ '--card-accent': '#a855f7', '--card-glow': 'rgba(168, 85, 247, 0.25)' } as React.CSSProperties}
          >
            <div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.25), rgba(147, 51, 234, 0.1))',
                  border: '1px solid rgba(168, 85, 247, 0.35)',
                  marginBottom: '16px',
                }}
              >
                <Layers size={22} color="#c084fc" />
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 6px 0', color: '#ffffff' }}>
                Deploy War Room
              </h3>
              <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 20px 0', lineHeight: 1.4 }}>
                Spin up a named command center for your squad with custom codecs and invite links.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                width: '100%',
                padding: '11px 16px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #a855f7 0%, #9333ea 100%)',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 200ms ease',
                boxShadow: '0 4px 14px rgba(168, 85, 247, 0.3)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(168, 85, 247, 0.45)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(168, 85, 247, 0.3)';
              }}
            >
              <Plus size={16} />
              <span>Configure Room ⚡</span>
            </button>
          </div>

          {/* Card 4: Quick Frequency Hop (Direct ID Join) */}
          <div
            className="calling-hero-card"
            style={{ '--card-accent': '#06b6d4', '--card-glow': 'rgba(6, 182, 212, 0.25)' } as React.CSSProperties}
          >
            <div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.25), rgba(8, 145, 178, 0.1))',
                  border: '1px solid rgba(6, 182, 212, 0.35)',
                  marginBottom: '16px',
                }}
              >
                <Radio size={22} color="#22d3ee" />
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 6px 0', color: '#ffffff' }}>
                Direct Frequency Hop
              </h3>
              <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 16px 0', lineHeight: 1.4 }}>
                Got a Call ID or room link? Enter it below and warp straight into the frequency.
              </p>
            </div>

            <form onSubmit={handleQuickJoin} style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={quickJoinId}
                onChange={(e) => setQuickJoinId(e.target.value)}
                placeholder="Paste Call ID / link..."
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#ffffff',
                  fontSize: '12px',
                  outline: 'none',
                  minWidth: 0,
                }}
              />
              <button
                type="submit"
                style={{
                  padding: '9px 14px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap',
                }}
              >
                <span>Warp In</span>
                <ArrowUpRight size={14} />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* =========================================================================
          3. ACTIVE SESSIONS MONITOR
          ========================================================================= */}
      <section style={{ marginTop: '36px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.02em', margin: 0, color: '#f8fafc' }}>
              Active Call Frequencies
            </h2>
            {activeCount > 0 && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: 700,
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  color: '#34d399',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                }}
              >
                <span className="live-beacon" style={{ width: '6px', height: '6px' }} />
                <span>{activeCount} Live</span>
              </span>
            )}
          </div>
        </div>

        {activeLoading ? (
          <div
            style={{
              padding: '28px',
              borderRadius: '16px',
              backgroundColor: 'rgba(15, 23, 42, 0.5)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              color: '#94a3b8',
              fontSize: '14px',
            }}
          >
            <RefreshCw size={18} className="animate-spin" color="#6366f1" />
            <span>Scanning active frequencies...</span>
          </div>
        ) : activeCalls && activeCalls.length > 0 ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '16px',
            }}
          >
            {activeCalls.map((call) => {
              const isVideo = call.callType === CallType.VIDEO || call.callType === CallType.GROUP_VIDEO;
              const participants = call.participants || [];

              return (
                <div
                  key={call.id}
                  style={{
                    padding: '20px',
                    borderRadius: '16px',
                    backgroundColor: 'rgba(15, 23, 42, 0.85)',
                    border: '1px solid rgba(99, 102, 241, 0.25)',
                    boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.3)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '16px',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '3px',
                      background: 'linear-gradient(90deg, #10b981, #6366f1)',
                    }}
                  />

                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: isVideo ? 'rgba(99, 102, 241, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                          border: isVideo ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
                        }}
                      >
                        {isVideo ? <Video size={20} color="#818cf8" /> : <Phone size={20} color="#34d399" />}
                      </div>

                      <div>
                        <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', margin: 0 }}>
                          {call.roomName || `${call.callType} Session`}
                        </h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              padding: '2px 6px',
                              borderRadius: '6px',
                              backgroundColor: 'rgba(255, 255, 255, 0.06)',
                              color: '#94a3b8',
                              fontWeight: 600,
                            }}
                          >
                            {call.callType}
                          </span>
                          <span style={{ fontSize: '12px', color: '#64748b' }}>•</span>
                          <span style={{ fontSize: '12px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span className="live-beacon" style={{ width: '5px', height: '5px' }} />
                            <span>In Progress</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      title="Copy meeting link"
                      onClick={() => handleCopyLink(call.id, call.roomName)}
                      style={{
                        padding: '6px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: copiedId === call.id ? '#34d399' : '#94a3b8',
                        cursor: 'pointer',
                        transition: 'all 150ms ease',
                      }}
                    >
                      {copiedId === call.id ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </div>

                  {/* Participants Row & Join Action */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: '12px',
                      borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Users size={15} color="#94a3b8" />
                      <span style={{ fontSize: '13px', color: '#cbd5e1', fontWeight: 500 }}>
                        {participants.length} participant{participants.length !== 1 ? 's' : ''} in room
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        toastService.success(`Connecting to ${call.roomName || 'live session'}...`);
                        onJoinCall(call.id);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 18px',
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        color: '#ffffff',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                        transition: 'all 150ms ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.03)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                    >
                      <span>Join Now</span>
                      <ArrowUpRight size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Sassy Empty State for Active Calls */
          <div
            style={{
              padding: '36px 24px',
              borderRadius: '16px',
              backgroundColor: 'rgba(15, 23, 42, 0.5)',
              border: '1px dashed rgba(255, 255, 255, 0.1)',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Radio size={24} color="#818cf8" />
            </div>
            <div>
              <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#f1f5f9', margin: '0 0 4px 0' }}>
                Dead quiet on the airwaves.
              </h4>
              <p style={{ fontSize: '13px', color: '#64748b', margin: 0, maxWidth: '420px' }}>
                Nobody is broadcasting right now. Pick an action from the deck above and make some glorious noise.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* =========================================================================
          4. TRANSMISSION LOGS & CALL HISTORY
          ========================================================================= */}
      <section style={{ marginTop: '40px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            marginBottom: '16px',
          }}
        >
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.02em', margin: '0 0 4px 0', color: '#f8fafc' }}>
              Transmission Logs
            </h2>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>
              Full encrypted logs of past voice sessions, multi-party video summits, and direct connections.
            </p>
          </div>

          {/* Search Bar */}
          <div
            style={{
              position: 'relative',
              width: '280px',
            }}
          >
            <Search
              size={15}
              color="#64748b"
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search logs or callers..."
              style={{
                width: '100%',
                padding: '9px 12px 9px 34px',
                borderRadius: '10px',
                backgroundColor: 'rgba(15, 23, 42, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#ffffff',
                fontSize: '13px',
                outline: 'none',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '2px',
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Filter Tabs */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            paddingBottom: '16px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            marginBottom: '16px',
            flexWrap: 'wrap',
          }}
        >
          {(
            [
              { key: 'ALL', label: `All Logs (${historyCount})` },
              { key: 'VOICE', label: '🎙️ Voice Only' },
              { key: 'VIDEO', label: '📹 Video Only' },
              { key: 'ENDED', label: '✅ Completed' },
              { key: 'MISSED', label: '⚠️ Missed / Failed' },
            ] as const
          ).map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                  backgroundColor: isActive ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                  color: isActive ? '#a5b4fc' : '#94a3b8',
                  border: isActive ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Logs List */}
        {historyLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  height: '68px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(15, 23, 42, 0.4)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 20px',
                  gap: '16px',
                }}
              >
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.05)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ width: '140px', height: '14px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '4px', marginBottom: '8px' }} />
                  <div style={{ width: '90px', height: '10px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '4px' }} />
                </div>
              </div>
            ))}
          </div>
        ) : filteredHistory.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredHistory.map((call) => {
              const isVideo =
                call.callType === CallType.VIDEO ||
                call.callType === CallType.GROUP_VIDEO ||
                call.callType === CallType.CONFERENCE;
              const isMissedOrFailed =
                call.status === CallSessionStatus.MISSED ||
                call.status === CallSessionStatus.FAILED ||
                call.status === CallSessionStatus.REJECTED;

              const date = new Date(call.startedAt);
              const durationSec =
                call.endedAt && call.activeAt
                  ? Math.floor((new Date(call.endedAt).getTime() - new Date(call.activeAt).getTime()) / 1000)
                  : 0;

              return (
                <div
                  key={call.id}
                  className="calling-interactive-row"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  {/* Left: Icon & Meta */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: isMissedOrFailed
                          ? 'rgba(244, 63, 94, 0.12)'
                          : isVideo
                          ? 'rgba(99, 102, 241, 0.12)'
                          : 'rgba(16, 185, 129, 0.12)',
                        border: isMissedOrFailed
                          ? '1px solid rgba(244, 63, 94, 0.25)'
                          : isVideo
                          ? '1px solid rgba(99, 102, 241, 0.25)'
                          : '1px solid rgba(16, 185, 129, 0.25)',
                      }}
                    >
                      {isMissedOrFailed ? (
                        <PhoneOff size={20} color="#fb7185" />
                      ) : isVideo ? (
                        <Video size={20} color="#818cf8" />
                      ) : (
                        <Phone size={20} color="#34d399" />
                      )}
                    </div>

                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>
                          {call.roomName || `${call.callType} Transmission`}
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            color: '#64748b',
                            fontFamily: 'var(--nv-font-mono)',
                          }}
                        >
                          #{call.id.slice(0, 8)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                          {date.toLocaleDateString([], { month: 'short', day: 'numeric' })} at{' '}
                          {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span style={{ fontSize: '12px', color: '#475569' }}>•</span>
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                          {call.participants?.length || 1} participant{call.participants?.length === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Duration, Status, Re-dial */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    {durationSec > 0 && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          backgroundColor: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          fontSize: '12px',
                          fontFamily: 'var(--nv-font-mono)',
                          color: '#cbd5e1',
                        }}
                      >
                        <Clock size={13} color="#94a3b8" />
                        <span>{formatDuration(durationSec)}</span>
                      </div>
                    )}

                    {/* Status Pill */}
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '11px',
                        fontWeight: 700,
                        letterSpacing: '0.02em',
                        backgroundColor:
                          call.status === CallSessionStatus.ENDED
                            ? 'rgba(100, 116, 139, 0.15)'
                            : isMissedOrFailed
                            ? 'rgba(244, 63, 94, 0.15)'
                            : 'rgba(16, 185, 129, 0.15)',
                        color:
                          call.status === CallSessionStatus.ENDED
                            ? '#94a3b8'
                            : isMissedOrFailed
                            ? '#fb7185'
                            : '#34d399',
                        border:
                          call.status === CallSessionStatus.ENDED
                            ? '1px solid rgba(100, 116, 139, 0.3)'
                            : isMissedOrFailed
                            ? '1px solid rgba(244, 63, 94, 0.3)'
                            : '1px solid rgba(16, 185, 129, 0.3)',
                      }}
                    >
                      {call.status}
                    </span>

                    {/* Copy Link Button */}
                    <button
                      type="button"
                      title="Copy meeting link"
                      onClick={() => handleCopyLink(call.id, call.roomName)}
                      style={{
                        padding: '7px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        color: copiedId === call.id ? '#34d399' : '#94a3b8',
                        cursor: 'pointer',
                        transition: 'all 150ms ease',
                      }}
                    >
                      {copiedId === call.id ? <Check size={14} /> : <Copy size={14} />}
                    </button>

                    {/* Re-dial Button */}
                    <button
                      type="button"
                      title="Re-open this frequency"
                      onClick={() => handleStartCall(call.callType, call.roomName)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(99, 102, 241, 0.15)',
                        border: '1px solid rgba(99, 102, 241, 0.3)',
                        color: '#a5b4fc',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 150ms ease',
                      }}
                    >
                      <span>Re-dial</span>
                      <ArrowUpRight size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Sassy Empty State for Call History */
          <div
            style={{
              padding: '48px 24px',
              borderRadius: '16px',
              backgroundColor: 'rgba(15, 23, 42, 0.5)',
              border: '1px dashed rgba(255, 255, 255, 0.1)',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Clock size={24} color="#818cf8" />
            </div>
            <div>
              <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#f1f5f9', margin: '0 0 4px 0' }}>
                {searchQuery ? 'Radar sweep found zero matches.' : 'Pristine Transmission Log.'}
              </h4>
              <p style={{ fontSize: '13px', color: '#64748b', margin: 0, maxWidth: '420px' }}>
                {searchQuery
                  ? 'No transmissions matched your filter criteria. Try a different query or reset your filters.'
                  : 'Zero past calls recorded. Your communications slate is completely spotless—time to make your mark.'}
              </p>
            </div>
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setActiveTab('ALL');
                  toastService.info('Filters cleared. Showing all transmissions.');
                }}
                style={{
                  marginTop: '6px',
                  padding: '7px 16px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(99, 102, 241, 0.2)',
                  border: '1px solid rgba(99, 102, 241, 0.4)',
                  color: '#a5b4fc',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Clear Search & Filters
              </button>
            )}
          </div>
        )}
      </section>

      {/* =========================================================================
          5. CUSTOM WAR ROOM CONFIGURATION MODAL
          ========================================================================= */}
      {isModalOpen && (
        <div className="glass-modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              padding: '28px',
              borderRadius: '20px',
              backgroundColor: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(168, 85, 247, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(168, 85, 247, 0.3)',
                  }}
                >
                  <Zap size={18} color="#c084fc" />
                </div>
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                    Deploy Custom Room
                  </h3>
                  <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>
                    Configure dedicated mission control & security protocols.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{
                  padding: '6px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateCustomRoom} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              {/* Room Name Input */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '8px' }}>
                  War Room Designation
                </label>
                <input
                  type="text"
                  value={customRoomName}
                  onChange={(e) => setCustomRoomName(e.target.value)}
                  placeholder="e.g. Q4 Growth Sprint, Daily Roast, Design Review"
                  required
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#ffffff',
                    fontSize: '14px',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Protocol / Type Selection */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#cbd5e1', marginBottom: '8px' }}>
                  Media Protocol
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setCustomCallType(CallType.VIDEO)}
                    style={{
                      padding: '12px',
                      borderRadius: '12px',
                      backgroundColor:
                        customCallType === CallType.VIDEO ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                      border:
                        customCallType === CallType.VIDEO
                          ? '1px solid rgba(99, 102, 241, 0.5)'
                          : '1px solid rgba(255, 255, 255, 0.08)',
                      color: customCallType === CallType.VIDEO ? '#ffffff' : '#94a3b8',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    <Video size={20} color={customCallType === CallType.VIDEO ? '#818cf8' : '#64748b'} />
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>1080p Video</span>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>WebRTC SFU Mesh</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCustomCallType(CallType.VOICE)}
                    style={{
                      padding: '12px',
                      borderRadius: '12px',
                      backgroundColor:
                        customCallType === CallType.VOICE ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                      border:
                        customCallType === CallType.VOICE
                          ? '1px solid rgba(16, 185, 129, 0.5)'
                          : '1px solid rgba(255, 255, 255, 0.08)',
                      color: customCallType === CallType.VOICE ? '#ffffff' : '#94a3b8',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: 'pointer',
                    }}
                  >
                    <Phone size={20} color={customCallType === CallType.VOICE ? '#34d399' : '#64748b'} />
                    <span style={{ fontSize: '13px', fontWeight: 600 }}>HD Voice</span>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>48kHz Opus Audio</span>
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    padding: '10px 18px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#94a3b8',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={initiateMutation.isPending}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 22px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #a855f7 0%, #9333ea 100%)',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(168, 85, 247, 0.35)',
                  }}
                >
                  <Sparkles size={16} />
                  <span>{initiateMutation.isPending ? 'Deploying...' : 'Deploy Room & Enter'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
