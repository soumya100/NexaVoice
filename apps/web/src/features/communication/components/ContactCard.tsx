import React from 'react';
import { Phone, Video, MessageSquare, Star, MoreVertical } from 'lucide-react';
import { ContactRelationship } from '../hooks/useContacts';
import { PresenceBadge } from './PresenceBadge';
import { useUserPresence } from '../hooks/usePresence';

interface ContactCardProps {
  contact: ContactRelationship;
  onStartCall: (targetUserId: string, callType: 'VOICE' | 'VIDEO') => void;
  onOpenConversation: (targetUserId: string) => void;
  onToggleFavorite: (contactUserId: string, isFavorite: boolean) => void;
  onManageGroups?: (contactUserId: string) => void;
}

export const ContactCard: React.FC<ContactCardProps> = ({
  contact,
  onStartCall,
  onOpenConversation,
  onToggleFavorite,
  onManageGroups,
}) => {
  const { data: presence } = useUserPresence(contact.contactUserId);

  const user = contact.contactUser;
  const status = presence?.status || (user.isOnline ? 'ONLINE' : 'OFFLINE');
  const availability = presence?.availability;
  const customStatus = presence?.customStatus;

  return (
    <div className="group relative flex items-center justify-between p-3.5 bg-slate-900/60 hover:bg-slate-850/80 border border-slate-800/80 hover:border-slate-700/60 rounded-2xl transition-all shadow-sm hover:shadow-md">
      {/* Left: Avatar & Info */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative flex-shrink-0">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-bold text-base shadow-inner overflow-hidden border border-slate-700/40">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.displayName} className="w-full h-full object-cover" />
            ) : (
              user.displayName?.charAt(0).toUpperCase() || 'U'
            )}
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 ring-2 ring-slate-900 rounded-full">
            <PresenceBadge
              status={status}
              availability={availability}
              customStatus={customStatus}
              size="sm"
            />
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h4 className="text-sm font-semibold text-slate-100 truncate group-hover:text-indigo-300 transition">
              {contact.alias || user.displayName}
            </h4>
            {contact.isFavorite && (
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 flex-shrink-0" />
            )}
          </div>
          <p className="text-xs text-slate-400 truncate flex items-center gap-1">
            <span>@{user.username}</span>
            <span className="text-slate-600">•</span>
            <span className="font-mono text-[10px] text-slate-500">{user.nexaVoiceId}</span>
          </p>
          {customStatus && (
            <p className="text-[11px] text-slate-400 italic truncate mt-0.5">{customStatus}</p>
          )}
        </div>
      </div>

      {/* Right: Quick Actions */}
      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onToggleFavorite(contact.contactUserId, !contact.isFavorite)}
          className={`p-2 rounded-xl transition ${
            contact.isFavorite
              ? 'text-amber-400 hover:text-amber-300 bg-amber-400/10'
              : 'text-slate-400 hover:text-amber-300 hover:bg-slate-800'
          }`}
          title={contact.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Star className={`w-4 h-4 ${contact.isFavorite ? 'fill-amber-400' : ''}`} />
        </button>

        <button
          onClick={() => onOpenConversation(contact.contactUserId)}
          className="p-2 rounded-xl text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition"
          title="Send message"
        >
          <MessageSquare className="w-4 h-4" />
        </button>

        <button
          onClick={() => onStartCall(contact.contactUserId, 'VOICE')}
          className="p-2 rounded-xl text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition"
          title="Voice call"
        >
          <Phone className="w-4 h-4" />
        </button>

        <button
          onClick={() => onStartCall(contact.contactUserId, 'VIDEO')}
          className="p-2 rounded-xl text-slate-400 hover:text-violet-400 hover:bg-slate-800 transition"
          title="Video call"
        >
          <Video className="w-4 h-4" />
        </button>

        {onManageGroups && (
          <button
            onClick={() => onManageGroups(contact.contactUserId)}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
            title="Manage groups"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
