import React, { useState } from 'react';
import { Search, UserPlus, Users, Star, FolderPlus } from 'lucide-react';
import { useContacts, ContactRelationship } from '../hooks/useContacts';
import { ContactCard } from './ContactCard';

interface ContactListProps {
  onStartCall: (targetUserId: string, callType: 'VOICE' | 'VIDEO') => void;
  onOpenConversation: (targetUserId: string) => void;
  onOpenAddContact: () => void;
  onOpenManageGroups: () => void;
}

export const ContactList: React.FC<ContactListProps> = ({
  onStartCall,
  onOpenConversation,
  onOpenAddContact,
  onOpenManageGroups,
}) => {
  const { contacts, groups, isLoading, toggleFavorite } = useContacts();
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'ALL' | 'FAVORITES' | 'ONLINE' | string>('ALL');

  // Filter contacts
  const filteredContacts = contacts.filter((contact: ContactRelationship) => {
    // Search query
    const term = search.toLowerCase();
    const user = contact.contactUser;
    const matchesSearch =
      !term ||
      user.displayName?.toLowerCase().includes(term) ||
      user.username?.toLowerCase().includes(term) ||
      user.nexaVoiceId?.toLowerCase().includes(term) ||
      contact.alias?.toLowerCase().includes(term);

    if (!matchesSearch) return false;

    // Filter mode
    if (filterMode === 'FAVORITES') return contact.isFavorite;
    if (filterMode === 'ONLINE') return user.isOnline;
    if (filterMode !== 'ALL') {
      // Custom group ID
      const group = groups.find((g) => g.id === filterMode);
      if (group) {
        return group.members.some((m) => m.contactUserId === contact.contactUserId);
      }
    }

    return true;
  });

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100">
      {/* Top Header */}
      <div className="p-4 border-b border-slate-800/80 space-y-3 bg-slate-900/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold text-white tracking-tight">Contacts</h2>
            <span className="px-2 py-0.5 text-xs font-semibold text-slate-400 bg-slate-800 rounded-full">
              {contacts.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenManageGroups}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-850 hover:bg-slate-800 border border-slate-700/60 rounded-xl transition shadow-sm"
              title="Manage Contact Groups"
            >
              <FolderPlus className="w-3.5 h-3.5 text-indigo-400" />
              <span>Groups</span>
            </button>
            <button
              onClick={onOpenAddContact}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition shadow-md shadow-indigo-600/20"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Contact</span>
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, @username, or NexaVoice ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-900/80 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/70 focus:ring-1 focus:ring-indigo-500/50 transition"
          />
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs font-medium">
          <button
            onClick={() => setFilterMode('ALL')}
            className={`px-3 py-1 rounded-lg transition whitespace-nowrap ${
              filterMode === 'ALL'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
            }`}
          >
            All Contacts
          </button>
          <button
            onClick={() => setFilterMode('FAVORITES')}
            className={`flex items-center gap-1 px-3 py-1 rounded-lg transition whitespace-nowrap ${
              filterMode === 'FAVORITES'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
            }`}
          >
            <Star className="w-3 h-3 fill-current" />
            Favorites
          </button>
          <button
            onClick={() => setFilterMode('ONLINE')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition whitespace-nowrap ${
              filterMode === 'ONLINE'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Online
          </button>

          {groups.map((group) => (
            <button
              key={group.id}
              onClick={() => setFilterMode(group.id)}
              className={`px-3 py-1 rounded-lg transition whitespace-nowrap ${
                filterMode === group.id
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
              }`}
            >
              {group.name} ({group.members.length})
            </button>
          ))}
        </div>
      </div>

      {/* Contacts List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        {isLoading ? (
          <div className="py-16 text-center text-slate-500 text-sm">Loading contacts...</div>
        ) : filteredContacts.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-sm">
            <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>No contacts found</p>
            {search && <p className="text-xs text-slate-600 mt-1">Try another search term</p>}
          </div>
        ) : (
          filteredContacts.map((contact) => (
            <ContactCard
              key={contact.id}
              contact={contact}
              onStartCall={onStartCall}
              onOpenConversation={onOpenConversation}
              onToggleFavorite={toggleFavorite}
            />
          ))
        )}
      </div>
    </div>
  );
};
