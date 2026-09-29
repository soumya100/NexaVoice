import React from 'react';
import { Users, X, Mic, MicOff, ShieldCheck, UserX } from 'lucide-react';
import { CallParticipant } from '../types';

interface ParticipantDrawerProps {
  isOpen: boolean;
  participants: CallParticipant[];
  currentUserId: string;
  canMuteOthers: boolean;
  canRemoveOthers: boolean;
  onClose: () => void;
  onMuteParticipant: (userId: string, isAudioMuted: boolean) => void;
  onRemoveParticipant: (userId: string) => void;
}

export const ParticipantDrawer: React.FC<ParticipantDrawerProps> = ({
  isOpen,
  participants,
  currentUserId,
  canMuteOthers,
  canRemoveOthers,
  onClose,
  onMuteParticipant,
  onRemoveParticipant,
}) => {
  if (!isOpen) return null;

  return (
    <aside
      aria-label="Participants list"
      style={{
        position: 'fixed',
        top: 0,
        bottom: 0,
        right: 0,
        width: '340px',
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.6)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 50,
        padding: '20px',
        color: '#f8fafc',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={18} color="#818cf8" />
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>
            Participants ({participants.length})
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close participant drawer"
          style={{
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Participants List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {participants.map((p) => {
          const isSelf = p.userId === currentUserId;
          const initial = p.displayName ? p.displayName.charAt(0).toUpperCase() : 'U';

          return (
            <div
              key={p.userId}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: '14px',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)',
                  }}
                >
                  {initial}
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>{p.displayName}</span>
                    {isSelf && (
                      <span style={{ fontSize: '10px', color: '#94a3b8', background: 'rgba(255,255,255,0.08)', padding: '1px 6px', borderRadius: '4px' }}>
                        You
                      </span>
                    )}
                  </div>
                  {p.role && p.role !== 'PARTICIPANT' && (
                    <div style={{ fontSize: '10px', color: '#a5b4fc', fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                      <ShieldCheck size={11} /> {p.role}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons for Moderators */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {canMuteOthers && !isSelf && (
                  <button
                    type="button"
                    onClick={() => onMuteParticipant(p.userId, !p.isAudioMuted)}
                    title={p.isAudioMuted ? 'Unmute participant' : 'Mute participant'}
                    style={{
                      padding: '6px',
                      borderRadius: '8px',
                      background: p.isAudioMuted ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.08)',
                      border: 'none',
                      color: p.isAudioMuted ? '#f87171' : '#94a3b8',
                      cursor: 'pointer',
                    }}
                  >
                    {p.isAudioMuted ? <MicOff size={14} /> : <Mic size={14} />}
                  </button>
                )}
                {canRemoveOthers && !isSelf && (
                  <button
                    type="button"
                    onClick={() => onRemoveParticipant(p.userId)}
                    title="Remove participant"
                    style={{
                      padding: '6px',
                      borderRadius: '8px',
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: 'none',
                      color: '#f87171',
                      cursor: 'pointer',
                    }}
                  >
                    <UserX size={14} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
};

