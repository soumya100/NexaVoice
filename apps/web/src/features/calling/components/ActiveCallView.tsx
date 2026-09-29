import React, { useState } from 'react';
import { Radio, Users, AlertTriangle } from 'lucide-react';
import { useCallSession } from '../hooks/use-call-session';
import { CallTile } from './CallTile';
import { CallControls } from './CallControls';
import { ParticipantDrawer } from './ParticipantDrawer';
import { DeviceSelector } from './DeviceSelector';
import {
  useEndCallMutation,
  useMuteParticipantMutation,
  useRemoveParticipantMutation,
  useHoldCallMutation,
  useResumeCallMutation,
} from '../hooks/use-call-queries';

interface ActiveCallViewProps {
  callId: string;
  currentUserId: string;
  onLeaveCall?: () => void;
}

export function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export const ActiveCallView: React.FC<ActiveCallViewProps> = ({
  callId,
  currentUserId,
  onLeaveCall,
}) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const {
    call,
    connectionState,
    localStream,
    remoteStream,
    isAudioMuted,
    isVideoMuted,
    isScreenSharing,
    permissionError,
    elapsedDurationSeconds,
    toggleMic,
    toggleCamera,
    toggleScreen,
    participants,
  } = useCallSession(callId, currentUserId);

  const endCallMutation = useEndCallMutation();
  const muteMutation = useMuteParticipantMutation();
  const removeMutation = useRemoveParticipantMutation();
  const holdMutation = useHoldCallMutation();
  const resumeMutation = useResumeCallMutation();

  const currentParticipant = participants.find((p) => p.userId === currentUserId);
  const isHost = call?.hostUserId === currentUserId;
  const canMuteOthers = isHost || !!currentParticipant?.permissions.canMuteOthers;
  const canRemoveOthers = isHost || !!currentParticipant?.permissions.canRemoveParticipants;
  const isOnHold = call?.status === 'HELD' || !!currentParticipant?.isOnHold;

  const handleEndCall = async () => {
    try {
      await endCallMutation.mutateAsync({ callId });
    } catch {
      // Ignored if already ended
    }
    onLeaveCall?.();
  };

  const handleToggleHold = async () => {
    if (isOnHold) {
      await resumeMutation.mutateAsync(callId);
    } else {
      await holdMutation.mutateAsync(callId);
    }
  };

  const otherParticipants = participants.filter((p) => p.userId !== currentUserId);

  return (
    <main
      aria-label="Active Call Session"
      className="call-studio-root"
    >
      {/* Top Header Bar */}
      <header className="call-studio-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div className="call-studio-pulse-dot" />
          <h1 className="call-studio-title" style={{ margin: 0 }}>
            <Radio size={16} color="#818cf8" />
            <span>{call?.roomName || (call?.callType === 'VIDEO' ? 'Video Call' : 'Audio Call')}</span>
          </h1>
          <span className="call-studio-timer">
            {formatDuration(elapsedDurationSeconds)}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {connectionState !== 'connected' && connectionState !== 'new' && (
            <span className="call-studio-badge call-studio-badge-warning">
              {connectionState === 'connecting' ? 'Connecting...' : connectionState}
            </span>
          )}
          {call?.callType && (
            <span className="call-studio-badge call-studio-badge-info">
              {call.callType}
            </span>
          )}
        </div>
      </header>

      {/* Permission Warning if applicable */}
      {permissionError && (
        <div
          role="alert"
          style={{
            margin: '12px 24px 0',
            padding: '12px 18px',
            borderRadius: '12px',
            backgroundColor: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            color: '#fbbf24',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            zIndex: 10,
          }}
        >
          <AlertTriangle size={16} style={{ flexShrink: 0 }} />
          <span>{permissionError}</span>
        </div>
      )}

      {/* Main Video & Audio Grid */}
      <section aria-label="Media Streams" className="call-studio-stage">
        <div className="call-studio-grid">
          {/* Remote Stream Tile */}
          {otherParticipants.length > 0 ? (
            otherParticipants.map((p) => (
              <CallTile
                key={p.userId}
                stream={remoteStream}
                displayName={p.displayName}
                isAudioMuted={p.isAudioMuted}
                isVideoMuted={p.isVideoMuted}
                role={p.role}
                connectionState={connectionState}
              />
            ))
          ) : (
            <div className="call-waiting-card">
              <div className="call-waiting-radar">
                <Users size={30} />
              </div>
              <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#f1f5f9' }}>
                Waiting for other participants to join...
              </p>
              <p style={{ margin: '8px 0 0', fontSize: '12.5px', color: '#94a3b8' }}>
                Secure end-to-end encrypted session is active and listening.
              </p>
            </div>
          )}

          {/* Local User Preview Tile */}
          <CallTile
            stream={localStream}
            displayName={currentParticipant?.displayName || 'You'}
            isAudioMuted={isAudioMuted}
            isVideoMuted={isVideoMuted}
            isLocal={true}
            role={currentParticipant?.role}
          />
        </div>
      </section>

      {/* Bottom Controls Toolbar */}
      <CallControls
        isAudioMuted={isAudioMuted}
        isVideoMuted={isVideoMuted}
        isScreenSharing={isScreenSharing}
        isOnHold={isOnHold}
        participantCount={participants.length}
        onToggleAudio={toggleMic}
        onToggleVideo={toggleCamera}
        onToggleScreenShare={toggleScreen}
        onToggleHold={handleToggleHold}
        onOpenParticipants={() => setIsDrawerOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onEndCall={handleEndCall}
      />

      {/* Participant Management Drawer */}
      <ParticipantDrawer
        isOpen={isDrawerOpen}
        participants={participants}
        currentUserId={currentUserId}
        canMuteOthers={canMuteOthers}
        canRemoveOthers={canRemoveOthers}
        onClose={() => setIsDrawerOpen(false)}
        onMuteParticipant={(userId, muted) =>
          muteMutation.mutate({ callId, targetUserId: userId, isAudioMuted: muted })
        }
        onRemoveParticipant={(userId) =>
          removeMutation.mutate({ callId, targetUserId: userId, reason: 'REMOVED_BY_HOST' })
        }
      />

      {/* Device Settings Modal */}
      <DeviceSelector
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </main>
  );
};

