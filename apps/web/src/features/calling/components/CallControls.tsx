import React from 'react';

interface CallControlsProps {
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  isScreenSharing: boolean;
  isOnHold: boolean;
  participantCount: number;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onToggleHold: () => void;
  onOpenParticipants: () => void;
  onOpenSettings: () => void;
  onEndCall: () => void;
}

export const CallControls: React.FC<CallControlsProps> = ({
  isAudioMuted,
  isVideoMuted,
  isScreenSharing,
  isOnHold,
  participantCount,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onToggleHold,
  onOpenParticipants,
  onOpenSettings,
  onEndCall,
}) => {
  return (
    <nav
      aria-label="Call controls"
      className="flex items-center justify-center gap-3 sm:gap-4 px-4 py-3 rounded-2xl bg-neutral-900/80 backdrop-blur-xl border border-neutral-800 shadow-2xl"
    >
      {/* Mic Button */}
      <button
        type="button"
        onClick={onToggleAudio}
        aria-label={isAudioMuted ? 'Unmute Microphone' : 'Mute Microphone'}
        title={isAudioMuted ? 'Unmute Microphone' : 'Mute Microphone'}
        className={`flex items-center justify-center h-12 w-12 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
          isAudioMuted
            ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
            : 'bg-neutral-800 text-white hover:bg-neutral-700'
        }`}
      >
        {isAudioMuted ? (
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 19L5 5m14 6a7 7 0 01-11.41 5.41M12 19v3m-4 0h8m-4-7a3 3 0 01-3-3V7a3 3 0 014.24-2.73" />
          </svg>
        ) : (
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-14 0m14 0a7 7 0 00-14 0m7 7v4m-4 0h8m-4-8a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3z" />
          </svg>
        )}
      </button>

      {/* Video Button */}
      <button
        type="button"
        onClick={onToggleVideo}
        aria-label={isVideoMuted ? 'Turn on Camera' : 'Turn off Camera'}
        title={isVideoMuted ? 'Turn on Camera' : 'Turn off Camera'}
        className={`flex items-center justify-center h-12 w-12 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
          isVideoMuted
            ? 'bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30'
            : 'bg-neutral-800 text-white hover:bg-neutral-700'
        }`}
      >
        {isVideoMuted ? (
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2zM3 3l18 18" />
          </svg>
        ) : (
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        )}
      </button>

      {/* Screen Share Button */}
      <button
        type="button"
        onClick={onToggleScreenShare}
        aria-label={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
        title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
        className={`flex items-center justify-center h-12 w-12 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
          isScreenSharing
            ? 'bg-indigo-600 text-white shadow-md'
            : 'bg-neutral-800 text-white hover:bg-neutral-700'
        }`}
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </button>

      {/* Hold Button */}
      <button
        type="button"
        onClick={onToggleHold}
        aria-label={isOnHold ? 'Resume Call' : 'Hold Call'}
        title={isOnHold ? 'Resume Call' : 'Hold Call'}
        className={`flex items-center justify-center h-12 w-12 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
          isOnHold
            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            : 'bg-neutral-800 text-white hover:bg-neutral-700'
        }`}
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      {/* Participants Drawer Toggle */}
      <button
        type="button"
        onClick={onOpenParticipants}
        aria-label={`Participants (${participantCount})`}
        title={`Participants (${participantCount})`}
        className="relative flex items-center justify-center h-12 w-12 rounded-full bg-neutral-800 text-white hover:bg-neutral-700 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
          {participantCount}
        </span>
      </button>

      {/* Device Settings Button */}
      <button
        type="button"
        onClick={onOpenSettings}
        aria-label="Device Settings"
        title="Device Settings"
        className="flex items-center justify-center h-12 w-12 rounded-full bg-neutral-800 text-white hover:bg-neutral-700 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>

      {/* End Call Button */}
      <button
        type="button"
        onClick={onEndCall}
        aria-label="End Call"
        title="End Call"
        className="flex items-center justify-center h-12 w-16 sm:w-20 rounded-full bg-red-600 hover:bg-red-500 text-white transition-all shadow-lg active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-400"
      >
        <svg className="h-6 w-6 rotate-[135deg]" fill="currentColor" viewBox="0 0 24 24">
          <path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.24 1.01l-2.21 2.2z" />
        </svg>
      </button>
    </nav>
  );
};
