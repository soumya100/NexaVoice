import React from 'react';
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
      className="fixed inset-y-0 right-0 z-40 w-80 bg-neutral-900 border-l border-neutral-800 p-5 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
    >
      <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
        <h3 className="text-base font-semibold text-white">
          Participants ({participants.length})
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close participant drawer"
          className="text-neutral-400 hover:text-white p-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-4 space-y-3">
        {participants.map((p) => {
          const isSelf = p.userId === currentUserId;
          return (
            <div
              key={p.userId}
              className="flex items-center justify-between p-3 rounded-xl bg-neutral-800/50 border border-neutral-800"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600/30 text-indigo-400 font-semibold text-sm">
                  {p.displayName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-medium text-white flex items-center gap-1.5">
                    {p.displayName} {isSelf && <span className="text-neutral-500 text-xs">(You)</span>}
                  </div>
                  <span className="text-[11px] text-neutral-400 uppercase font-semibold">
                    {p.role} • {p.state}
                  </span>
                </div>
              </div>

              {/* Action Controls for Moderators */}
              <div className="flex items-center gap-1">
                {canMuteOthers && !isSelf && (
                  <button
                    type="button"
                    onClick={() => onMuteParticipant(p.userId, !p.isAudioMuted)}
                    title={p.isAudioMuted ? 'Unmute' : 'Mute'}
                    className={`p-1.5 rounded-lg text-xs ${
                      p.isAudioMuted
                        ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                        : 'text-neutral-400 hover:text-white hover:bg-neutral-700'
                    }`}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-14 0m14 0a7 7 0 00-14 0m7 7v4m-4 0h8m-4-8a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3z" />
                    </svg>
                  </button>
                )}

                {canRemoveOthers && !isSelf && (
                  <button
                    type="button"
                    onClick={() => onRemoveParticipant(p.userId)}
                    title="Remove from call"
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-red-500/10"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
                    </svg>
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
