import React from 'react';
import { CallSession } from '../types';

interface CallModalProps {
  call: CallSession;
  onAccept: () => void;
  onDecline: () => void;
}

export const CallModal: React.FC<CallModalProps> = ({ call, onAccept, onDecline }) => {
  const host = call.participants.find((p) => p.userId === call.hostUserId);
  const isVideo = call.callType === 'VIDEO' || call.callType === 'GROUP_VIDEO';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="incoming-call-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in"
    >
      <div className="relative w-full max-w-sm rounded-2xl bg-neutral-900 border border-neutral-800 p-6 shadow-2xl text-center text-white">
        {/* Pulsing Avatar */}
        <div className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-neutral-800 border-2 border-emerald-500 overflow-hidden text-2xl font-bold">
            {host?.avatarUrl ? (
              <img src={host.avatarUrl} alt={host.displayName} className="h-full w-full object-cover" />
            ) : (
              <span>{host?.displayName?.charAt(0).toUpperCase() || 'U'}</span>
            )}
          </div>
        </div>

        <h2 id="incoming-call-title" className="text-xl font-semibold tracking-tight">
          {host?.displayName || 'Incoming Call'}
        </h2>
        <p className="mt-1 text-sm text-neutral-400">
          NexaVoice {isVideo ? 'Video Call' : 'Audio Call'}
        </p>

        {/* Action Buttons */}
        <div className="mt-8 flex justify-center gap-6">
          <button
            type="button"
            onClick={onDecline}
            aria-label="Decline Call"
            className="flex flex-col items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-red-400 rounded-full"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 hover:bg-red-500 text-white transition-all shadow-lg active:scale-95">
              <svg className="h-6 w-6 rotate-[135deg]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.24 1.01l-2.21 2.2z" />
              </svg>
            </div>
            <span className="text-xs text-neutral-400 font-medium">Decline</span>
          </button>

          <button
            type="button"
            onClick={onAccept}
            aria-label="Accept Call"
            autoFocus
            className="flex flex-col items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-400 rounded-full"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-lg active:scale-95">
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.46.57 3.58a1 1 0 01-.24 1.01l-2.21 2.2z" />
              </svg>
            </div>
            <span className="text-xs text-neutral-400 font-medium">Accept</span>
          </button>
        </div>
      </div>
    </div>
  );
};
