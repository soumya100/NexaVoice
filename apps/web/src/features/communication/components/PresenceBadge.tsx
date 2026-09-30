import React from 'react';
import { PresenceStatus, UserAvailability } from '../hooks/usePresence';

interface PresenceBadgeProps {
  status?: PresenceStatus | string;
  availability?: UserAvailability | string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  customStatus?: string;
  className?: string;
}

export const PresenceBadge: React.FC<PresenceBadgeProps> = ({
  status = 'OFFLINE',
  availability,
  size = 'md',
  showLabel = false,
  customStatus,
  className = '',
}) => {
  // Determine effective visual state
  const isOnline = status === 'ONLINE';
  const isBusy = status === 'BUSY' || availability === 'BUSY' || availability === 'DO_NOT_DISTURB';
  const isInCall = availability === 'IN_CALL';
  const isAway = status === 'AWAY';

  let color = '#64748b'; // default offline gray
  let label = 'Offline';
  let pulse = false;

  if (isInCall) {
    color = '#8b5cf6'; // In Call purple
    label = 'In Call';
    pulse = true;
  } else if (isBusy) {
    color = '#f59e0b'; // Busy amber
    label = 'Busy';
  } else if (isAway) {
    color = '#eab308'; // Away yellow
    label = 'Away';
  } else if (isOnline) {
    color = '#10b981'; // Online emerald
    label = 'Online';
    pulse = true;
  }

  const dotSize = size === 'sm' ? 8 : size === 'lg' ? 14 : 10;

  return (
    <div
      className={`inline-flex items-center gap-1.5 ${className}`}
      title={customStatus ? `${label} - ${customStatus}` : label}
    >
      <span
        style={{
          width: dotSize,
          height: dotSize,
          borderRadius: '50%',
          backgroundColor: color,
          display: 'inline-block',
          boxShadow: pulse ? `0 0 0 2px rgba(16, 185, 129, 0.2)` : 'none',
          position: 'relative',
        }}
      >
        {pulse && (
          <span
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              backgroundColor: color,
              opacity: 0.5,
              animation: 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
            }}
          />
        )}
      </span>
      {showLabel && (
        <span style={{ fontSize: size === 'sm' ? '0.75rem' : '0.87rem', color: '#94a3b8' }}>
          {customStatus || label}
        </span>
      )}
    </div>
  );
};
