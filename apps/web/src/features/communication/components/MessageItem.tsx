import React, { useState } from 'react';
import {
  Check,
  CheckCheck,
  Clock,
  Phone,
  Sparkles,
  Play,
  Pause,
  Reply,
  Smile,
  Trash2,
} from 'lucide-react';
import { MessageItem as MessageData } from '../hooks/useConversations';

interface MessageItemProps {
  message: MessageData;
  isCurrentUser: boolean;
  onReply?: (message: MessageData) => void;
  onAddReaction?: (messageId: string, reaction: string) => void;
  onDelete?: (messageId: string) => void;
}

const EMOJI_PRESETS = ['👍', '❤️', '🎉', '🔥', '👏', '👀'];

export const MessageItemComponent: React.FC<MessageItemProps> = ({
  message,
  isCurrentUser,
  onReply,
  onAddReaction,
  onDelete,
}) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Parse CALL_EVENT / AI_EVENT if applicable
  const isCallEvent = message.type === 'CALL_EVENT';
  const isAiEvent = message.type === 'AI_EVENT';

  let eventPayload: any = null;
  if (isCallEvent || isAiEvent) {
    try {
      eventPayload = JSON.parse(message.content);
    } catch (_) {
      eventPayload = { raw: message.content };
    }
  }

  // Delivery status icon
  const renderDeliveryStatus = () => {
    if (!isCurrentUser) return null;
    switch (message.deliveryStatus) {
      case 'READ':
        return (
          <span title="Read">
            <CheckCheck className="w-3.5 h-3.5 text-sky-400" />
          </span>
        );
      case 'DELIVERED':
        return (
          <span title="Delivered">
            <CheckCheck className="w-3.5 h-3.5 text-slate-400" />
          </span>
        );
      case 'SENT':
        return (
          <span title="Sent">
            <Check className="w-3.5 h-3.5 text-slate-400" />
          </span>
        );
      default:
        return (
          <span title="Sending">
            <Clock className="w-3 h-3 text-slate-500" />
          </span>
        );
    }
  };

  // Special Call Event Card
  if (isCallEvent && eventPayload) {
    const isStarted = eventPayload.event === 'CALL_STARTED';
    return (
      <div className="flex justify-center my-3">
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/80 border border-slate-800 rounded-full text-xs text-slate-300 shadow-sm backdrop-blur-sm">
          <Phone className={`w-3.5 h-3.5 ${isStarted ? 'text-emerald-400' : 'text-slate-400'}`} />
          {isStarted ? (
            <span>Call started • {eventPayload.callType || 'Voice'}</span>
          ) : (
            <span>
              Call ended • Duration: {Math.floor((eventPayload.durationSeconds || 0) / 60)}m{' '}
              {(eventPayload.durationSeconds || 0) % 60}s
            </span>
          )}
          <span className="text-[10px] text-slate-500">
            {new Date(message.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      </div>
    );
  }

  // Special AI Summary Event Card
  if (isAiEvent && eventPayload) {
    return (
      <div className="flex justify-center my-4">
        <div className="w-full max-w-md p-4 bg-gradient-to-br from-indigo-950/40 via-slate-900/90 to-purple-950/40 border border-indigo-800/40 rounded-2xl shadow-lg backdrop-blur-md text-slate-200 space-y-2.5">
          <div className="flex items-center justify-between border-b border-indigo-900/40 pb-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-300">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>AI Call Intelligence Summary</span>
            </div>
            {eventPayload.sentiment && (
              <span className="px-2 py-0.5 text-[10px] font-medium bg-indigo-900/50 text-indigo-200 border border-indigo-700/40 rounded-full">
                {eventPayload.sentiment}
              </span>
            )}
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">{eventPayload.overview}</p>

          {eventPayload.keyPoints && Array.isArray(eventPayload.keyPoints) && (
            <div className="space-y-1 pt-1">
              <span className="text-[11px] font-semibold text-slate-400">Key Highlights:</span>
              <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                {eventPayload.keyPoints.map((pt: string, idx: number) => (
                  <li key={idx} className="text-slate-300">
                    {pt}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="text-[10px] text-right text-slate-500 pt-1">
            Generated at{' '}
            {new Date(message.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>
      </div>
    );
  }

  // Standard Chat Message Bubble
  return (
    <div
      className={`group relative flex flex-col ${
        isCurrentUser ? 'items-end' : 'items-start'
      } my-1.5 px-2`}
    >
      <div className="flex items-end gap-2 max-w-[80%]">
        {!isCurrentUser && (
          <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm">
            {message.sender?.displayName?.charAt(0).toUpperCase() || 'U'}
          </div>
        )}

        <div className="relative">
          {/* Bubble */}
          <div
            className={`p-3 rounded-2xl shadow-sm text-sm break-words ${
              isCurrentUser
                ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-br-sm'
                : 'bg-slate-850 border border-slate-800 text-slate-100 rounded-bl-sm'
            }`}
          >
            {/* Sender Name if Group message */}
            {!isCurrentUser && (
              <div className="text-[11px] font-semibold text-indigo-400 mb-1">
                {message.sender?.displayName}
              </div>
            )}

            {/* Voice Audio Message */}
            {message.type === 'VOICE' ? (
              <div className="flex items-center gap-3 py-1 min-w-[200px]">
                <button
                  onClick={() => setIsPlayingAudio(!isPlayingAudio)}
                  className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition"
                >
                  {isPlayingAudio ? (
                    <Pause className="w-4 h-4 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 fill-current" />
                  )}
                </button>
                <div className="flex-1">
                  <div className="h-1.5 bg-white/30 rounded-full overflow-hidden">
                    <div className="w-1/3 h-full bg-white rounded-full" />
                  </div>
                  <span className="text-[10px] text-white/80 mt-1 block">Voice Note</span>
                </div>
              </div>
            ) : (
              <p className="leading-relaxed whitespace-pre-wrap">{message.content}</p>
            )}

            {/* Timestamp & Status */}
            <div
              className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                isCurrentUser ? 'text-indigo-200' : 'text-slate-400'
              }`}
            >
              <span>
                {new Date(message.createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              {message.isEdited && <span className="italic">(edited)</span>}
              {renderDeliveryStatus()}
            </div>
          </div>

          {/* Reactions Row */}
          {message.reactions && message.reactions.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {message.reactions.map((r: any) => (
                <button
                  key={r.id}
                  onClick={() => onAddReaction && onAddReaction(message.id, r.reaction)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-900 border border-slate-800 rounded-full text-xs text-slate-300 hover:border-slate-700 transition"
                >
                  <span>{r.reaction}</span>
                </button>
              ))}
            </div>
          )}

          {/* Hover Quick Action Buttons */}
          <div
            className={`absolute top-0 ${
              isCurrentUser ? 'left-0 -translate-x-full pr-2' : 'right-0 translate-x-full pl-2'
            } hidden group-hover:flex items-center gap-1 bg-slate-900/90 border border-slate-800 p-1 rounded-xl shadow-lg backdrop-blur-sm`}
          >
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 transition"
              title="Add reaction"
            >
              <Smile className="w-3.5 h-3.5" />
            </button>
            {onReply && (
              <button
                onClick={() => onReply(message)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 transition"
                title="Reply"
              >
                <Reply className="w-3.5 h-3.5" />
              </button>
            )}
            {isCurrentUser && onDelete && (
              <button
                onClick={() => onDelete(message.id)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 transition"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Emoji Picker Popover */}
          {showEmojiPicker && (
            <div className="absolute z-20 bottom-full mb-1 flex gap-1 p-1.5 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
              {EMOJI_PRESETS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    if (onAddReaction) onAddReaction(message.id, emoji);
                    setShowEmojiPicker(false);
                  }}
                  className="p-1.5 text-base hover:scale-125 transition-transform"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
