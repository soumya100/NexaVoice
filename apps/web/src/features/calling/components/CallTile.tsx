import React, { useEffect, useRef } from 'react';

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

  return (
    <div className="relative flex flex-col items-center justify-center w-full h-full min-h-[220px] rounded-2xl bg-neutral-900 border border-neutral-800 overflow-hidden shadow-lg group">
      {/* Video Element */}
      {stream && !isVideoMuted ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={`h-full w-full object-cover ${isLocal ? 'scale-x-[-1]' : ''}`}
        />
      ) : (
        <div className="flex flex-col items-center justify-center p-6 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-600 to-violet-600 text-2xl font-bold text-white shadow-xl mb-3">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-medium text-neutral-300">{displayName}</span>
          {isVideoMuted && (
            <span className="text-xs text-neutral-500 mt-1">Camera off</span>
          )}
        </div>
      )}

      {/* Top Badges */}
      <div className="absolute top-3 left-3 flex items-center gap-2">
        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-black/60 backdrop-blur-md text-white border border-white/10">
          {displayName} {isLocal && '(You)'}
        </span>
        {role && role !== 'PARTICIPANT' && (
          <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            {role}
          </span>
        )}
      </div>

      {/* Connection State Badge if reconnecting/failed */}
      {connectionState && connectionState !== 'connected' && connectionState !== 'new' && (
        <div className="absolute top-3 right-3 px-2 py-1 rounded text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
          {connectionState}
        </div>
      )}

      {/* Bottom Status Indicators */}
      <div className="absolute bottom-3 right-3 flex items-center gap-2">
        <span
          role="status"
          aria-label={isAudioMuted ? 'Microphone muted' : 'Microphone active'}
          className={`flex items-center justify-center h-8 w-8 rounded-full backdrop-blur-md ${
            isAudioMuted
              ? 'bg-red-500/80 text-white'
              : 'bg-black/50 text-emerald-400 border border-white/10'
          }`}
        >
          {isAudioMuted ? (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 19L5 5m14 6a7 7 0 01-11.41 5.41M12 19v3m-4 0h8m-4-7a3 3 0 01-3-3V7a3 3 0 014.24-2.73" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-14 0m14 0a7 7 0 00-14 0m7 7v4m-4 0h8m-4-8a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3z" />
            </svg>
          )}
        </span>
      </div>
    </div>
  );
};
