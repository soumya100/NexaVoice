import React, { useState } from 'react';
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
      className="relative flex flex-col h-full w-full bg-neutral-950 text-white overflow-hidden select-none"
    >
      {/* Top Header Bar */}
      <header className="flex items-center justify-between px-6 py-4 z-10 bg-gradient-to-b from-neutral-900/80 to-transparent">
        <div className="flex items-center gap-3">
          <div className="flex h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
          <h1 className="text-base font-semibold tracking-tight text-white">
            {call?.roomName || (call?.callType === 'VIDEO' ? 'Video Call' : 'Audio Call')}
          </h1>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700 font-mono font-medium">
            {formatDuration(elapsedDurationSeconds)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {connectionState !== 'connected' && connectionState !== 'new' && (
            <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
              {connectionState === 'connecting' ? 'Connecting...' : connectionState}
            </span>
          )}
        </div>
      </header>

      {/* Permission Warning if applicable */}
      {permissionError && (
        <div role="alert" className="mx-6 mb-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
          <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{permissionError}</span>
        </div>
      )}

      {/* Main Video Grid */}
      <section aria-label="Media Streams" className="flex-1 p-4 overflow-hidden flex items-center justify-center">
        <div className="w-full h-full max-w-6xl grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-2 auto-rows-fr">
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
            <div className="flex flex-col items-center justify-center rounded-2xl bg-neutral-900/40 border border-neutral-800 p-8 text-center text-neutral-400">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-800 mb-4 animate-pulse">
                <svg className="h-8 w-8 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <p className="text-sm font-medium">Waiting for other participants to join...</p>
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
      <footer className="p-4 flex justify-center z-10 bg-gradient-to-t from-neutral-900/80 to-transparent">
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
      </footer>

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
