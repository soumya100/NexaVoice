import React, { useState } from 'react';
import { X, Search, UserPlus, Check } from 'lucide-react';
import { useDiscoverUsers, useContacts } from '../hooks/useContacts';

interface ContactRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ContactRequestModal: React.FC<ContactRequestModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [note, setNote] = useState('');
  const [isSending, setIsSending] = useState(false);

  const { data: searchResults, isLoading: isSearching } = useDiscoverUsers(searchQuery);
  const { sendRequest } = useContacts();

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!selectedUser) return;
    try {
      setIsSending(true);
      await sendRequest(selectedUser.id, note);
      setSelectedUser(null);
      setNote('');
      setSearchQuery('');
      onClose();
    } catch (_) {
      // error handled in hook
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
    >
      <div
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-indigo-400" />
            <h3 className="font-semibold text-white">Add New Contact</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by username (e.g. alice) or NexaVoice ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          {/* Search Results */}
          {searchQuery.trim().length >= 2 && (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {isSearching ? (
                <div className="py-6 text-center text-xs text-slate-500">Searching directory...</div>
              ) : !searchResults || searchResults.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500">
                  No discoverable users found matching "{searchQuery}"
                </div>
              ) : (
                searchResults.map((user) => (
                  <div
                    key={user.id}
                    onClick={() => setSelectedUser(user)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition cursor-pointer ${
                      selectedUser?.id === user.id
                        ? 'bg-indigo-950/40 border-indigo-600/60'
                        : 'bg-slate-950/60 border-slate-850 hover:border-slate-750'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-bold text-sm">
                        {user.displayName?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white">{user.displayName}</div>
                        <div className="text-xs text-slate-400">
                          @{user.username} • <span className="font-mono">{user.nexaVoiceId}</span>
                        </div>
                      </div>
                    </div>
                    {selectedUser?.id === user.id && (
                      <Check className="w-4 h-4 text-indigo-400 mr-2" />
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Selected User & Note */}
          {selectedUser && (
            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
              <div className="text-xs font-medium text-slate-400">
                Sending request to <strong className="text-white">{selectedUser.displayName}</strong>
              </div>
              <textarea
                placeholder="Optional friendly note (e.g. 'Hey, it's Bob from Engineering')..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="w-full p-2 text-xs bg-slate-900 border border-slate-700/60 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={!selectedUser || isSending}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition shadow-md shadow-indigo-600/20"
            >
              {isSending ? 'Sending...' : 'Send Request'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
