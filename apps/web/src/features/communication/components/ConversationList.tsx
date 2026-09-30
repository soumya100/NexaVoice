import React, { useState } from 'react';
import { MessageSquare, Search, Plus, Users, Hash } from 'lucide-react';
import { ConversationItem } from '../hooks/useConversations';

interface ConversationListProps {
  conversations: ConversationItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNewConversation?: () => void;
  isLoading?: boolean;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  selectedId,
  onSelect,
  onNewConversation,
  isLoading,
}) => {
  const [search, setSearch] = useState('');

  const filtered = conversations.filter((c) => {
    const term = search.toLowerCase();
    return !term || c.title?.toLowerCase().includes(term) || c.lastMessageSnippet?.toLowerCase().includes(term);
  });

  return (
    <div className="flex flex-col h-full bg-slate-950 border-r border-slate-800/80 text-slate-100">
      {/* Header */}
      <div className="p-4 border-b border-slate-800/80 space-y-3 bg-slate-900/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold text-white tracking-tight">Messages</h2>
          </div>
          {onNewConversation && (
            <button
              onClick={onNewConversation}
              className="p-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition shadow-md shadow-indigo-600/20"
              title="New Conversation"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search messages..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-900/80 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-850/40">
        {isLoading ? (
          <div className="py-12 text-center text-xs text-slate-500">Loading conversations...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
            No conversations found
          </div>
        ) : (
          filtered.map((conv) => {
            const isSelected = conv.id === selectedId;
            const isGroup = conv.type === 'GROUP';
            const isChannel = conv.type === 'CHANNEL';

            return (
              <div
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={`flex items-start gap-3 p-3.5 cursor-pointer transition ${
                  isSelected
                    ? 'bg-indigo-950/40 border-l-2 border-indigo-500'
                    : 'hover:bg-slate-900/60'
                }`}
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                    {isGroup ? (
                      <Users className="w-4 h-4" />
                    ) : isChannel ? (
                      <Hash className="w-4 h-4" />
                    ) : (
                      conv.title?.charAt(0).toUpperCase() || 'C'
                    )}
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <h4
                      className={`text-xs font-semibold truncate ${
                        isSelected ? 'text-white' : 'text-slate-200'
                      }`}
                    >
                      {conv.title || 'Conversation'}
                    </h4>
                    {conv.lastMessageAt && (
                      <span className="text-[10px] text-slate-500 flex-shrink-0">
                        {new Date(conv.lastMessageAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-1">
                    <p className="text-xs text-slate-400 truncate flex-1">
                      {conv.lastMessageSnippet || 'No messages yet'}
                    </p>
                    {conv.unreadCount > 0 && (
                      <span className="min-w-4 h-4 px-1 flex items-center justify-center text-[10px] font-bold text-white bg-indigo-600 rounded-full flex-shrink-0">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
