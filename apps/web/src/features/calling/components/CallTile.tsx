import React, { useEffect, useRef } from 'react';
import { Mic, MicOff, VideoOff, ShieldCheck, User } from 'lucide-react';

interface CallTileProps {
  stream?: MediaStream | null;
  displayName: string;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  isLocal?: boolean;
  role?: string;
  connectionState?: string;
}

export const CallTile: React.FC<CallTileProps> = ({
  stream,
  displayName,
  isAudioMuted,
  isVideoMuted,
  isLocal = false,
  role,
  connectionState,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const initial = displayName ? displayName.charAt(0).toUpperCase() : 'U';

  return (
    <div className="call-tile-card group">
      {/* Video Element or Luxury Avatar */}
      {stream && !isVideoMuted ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={`call-tile-video ${isLocal ? 'call-tile-mirror' : ''}`}
        />
      ) : (
        <div className="call-avatar-wrap">
          <div className="call-avatar-orb">
            {initial}
          </div>
          <span className="call-avatar-name">{displayName}</span>
          {isVideoMuted && (
            <span className="call-avatar-hint">
              <VideoOff size={12} color="#94a3b8" /> Camera off
            </span>
          )}
        </div>
      )}

      {/* Top Left Name & Role Badges */}
      <div className="call-tile-top-left">
        <span className="call-tile-name-tag">
          <User size={13} color="#94a3b8" />
          <span>{displayName} {isLocal && '(You)'}</span>
        </span>
        {role && role !== 'PARTICIPANT' && (
          <span className="call-tile-role-tag">
            <ShieldCheck size={11} style={{ display: 'inline', marginRight: '3px' }} />
            {role}
          </span>
        )}
      </div>

      {/* Connection State Badge if reconnecting/failed */}
      {connectionState && connectionState !== 'connected' && connectionState !== 'new' && (
        <div style={{ position: 'absolute', top: '14px', right: '14px', zIndex: 5 }}>
          <span className="call-studio-badge call-studio-badge-warning">
            {connectionState}
          </span>
        </div>
      )}

      {/* Bottom Right Microphone Status Indicator */}
      <div className="call-tile-bottom-right">
        <span
          role="status"
          aria-label={isAudioMuted ? 'Microphone muted' : 'Microphone active'}
          className={`call-tile-status-icon ${
            isAudioMuted ? 'call-tile-status-muted' : 'call-tile-status-active'
          }`}
        >
          {isAudioMuted ? <MicOff size={16} /> : <Mic size={16} />}
        </span>
      </div>
    </div>
  );
};

