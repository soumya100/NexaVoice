import React from 'react';
import { CallSession } from '../types';

interface CallWaitingBannerProps {
  activeCall: CallSession;
  heldCall?: CallSession;
  onSwap: (activeId: string, heldId: string) => Promise<void>;
  onMerge: (callIdA: string, callIdB: string) => Promise<void>;
  isSwapping?: boolean;
  isMerging?: boolean;
}

export const CallWaitingBanner: React.FC<CallWaitingBannerProps> = ({
  activeCall,
  heldCall,
  onSwap,
  onMerge,
  isSwapping = false,
  isMerging = false,
}) => {
  if (!heldCall) return null;

  return (
    <div
      role="region"
      aria-label="Call Waiting Notification"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 18px',
        backgroundColor: '#1e293b',
        border: '1px solid #f59e0b',
        borderRadius: '8px',
        color: '#f8fafc',
        marginBottom: '12px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span
          style={{
            display: 'inline-block',
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: '#f59e0b',
            boxShadow: '0 0 8px #f59e0b',
          }}
        />
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
            Call on Hold: {heldCall.roomName || heldCall.id}
          </div>
          <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            Active call: {activeCall.roomName || activeCall.id}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          type="button"
          disabled={isSwapping}
          onClick={() => onSwap(activeCall.id, heldCall.id)}
          style={{
            backgroundColor: '#3b82f6',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            padding: '6px 14px',
            fontWeight: 500,
            cursor: isSwapping ? 'not-allowed' : 'pointer',
            opacity: isSwapping ? 0.6 : 1,
            transition: 'background-color 0.15s ease',
          }}
        >
          {isSwapping ? 'Swapping...' : 'Swap Calls'}
        </button>

        <button
          type="button"
          disabled={isMerging}
          onClick={() => onMerge(activeCall.id, heldCall.id)}
          style={{
            backgroundColor: '#10b981',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            padding: '6px 14px',
            fontWeight: 500,
            cursor: isMerging ? 'not-allowed' : 'pointer',
            opacity: isMerging ? 0.6 : 1,
            transition: 'background-color 0.15s ease',
          }}
        >
          {isMerging ? 'Merging...' : 'Merge to Conference'}
        </button>
      </div>
    </div>
  );
};
