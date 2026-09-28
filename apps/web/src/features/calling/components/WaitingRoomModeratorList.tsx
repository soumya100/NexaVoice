import React from 'react';
import { CallParticipant } from '../types';
import { WaitingRoomState } from '@nexavoice/domain-types';

interface WaitingRoomModeratorListProps {
  participants: CallParticipant[];
  onAdmit: (userId: string) => Promise<void>;
  onDeny: (userId: string) => Promise<void>;
}

export const WaitingRoomModeratorList: React.FC<WaitingRoomModeratorListProps> = ({
  participants,
  onAdmit,
  onDeny,
}) => {
  const waitingParticipants = participants.filter(
    (p) => p.waitingState === WaitingRoomState.WAITING || p.waitingState === WaitingRoomState.JOIN_REQUESTED,
  );

  if (waitingParticipants.length === 0) return null;

  return (
    <div
      role="region"
      aria-label="Conference Waiting Room"
      style={{
        padding: '12px 16px',
        backgroundColor: '#1e293b',
        border: '1px solid #6366f1',
        borderRadius: '8px',
        marginBottom: '12px',
        color: '#f8fafc',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#c7d2fe' }}>
          Waiting Room ({waitingParticipants.length})
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {waitingParticipants.map((p) => (
          <div
            key={p.userId}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 10px',
              backgroundColor: '#0f172a',
              borderRadius: '6px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#6366f1',
                }}
              />
              <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{p.displayName || p.userId}</span>
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={() => onAdmit(p.userId)}
                style={{
                  padding: '4px 10px',
                  fontSize: '0.8rem',
                  backgroundColor: '#10b981',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Admit
              </button>
              <button
                type="button"
                onClick={() => onDeny(p.userId)}
                style={{
                  padding: '4px 10px',
                  fontSize: '0.8rem',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                Deny
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
