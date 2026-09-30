import React, { useState } from 'react';
import { X, FolderPlus, Folder, Users, Plus } from 'lucide-react';
import { useContacts, ContactGroup } from '../hooks/useContacts';

interface ContactGroupsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_COLORS = [
  '#6366f1', // Indigo
  '#ec4899', // Pink
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#06b6d4', // Cyan
];

export const ContactGroupsModal: React.FC<ContactGroupsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { groups, createGroup } = useContacts();
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setIsSubmitting(true);
      await createGroup(name.trim(), selectedColor);
      setName('');
    } catch (_) {
      // error handled in hook
    } finally {
      setIsSubmitting(false);
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
            <FolderPlus className="w-5 h-5 text-indigo-400" />
            <h3 className="font-semibold text-white">Contact Groups</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* Create Group Form */}
          <form onSubmit={handleCreate} className="space-y-3 p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl">
            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Create New Group
            </h4>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Group name (e.g. Core Team, VIPs)..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 px-3 py-2 text-xs bg-slate-900 border border-slate-700/60 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={!name.trim() || isSubmitting}
                className="flex items-center gap-1 px-3 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create</span>
              </button>
            </div>

            {/* Color picker */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[11px] text-slate-400">Color:</span>
              <div className="flex items-center gap-1.5">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSelectedColor(c)}
                    style={{ backgroundColor: c }}
                    className={`w-5 h-5 rounded-full transition-transform ${
                      selectedColor === c ? 'scale-125 ring-2 ring-white' : 'opacity-80 hover:opacity-100'
                    }`}
                  />
                ))}
              </div>
            </div>
          </form>

          {/* Existing Groups List */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Your Groups ({groups.length})
            </h4>

            {groups.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                <Folder className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No custom groups created yet
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {groups.map((group: ContactGroup) => (
                  <div
                    key={group.id}
                    className="flex items-center justify-between p-3 bg-slate-950/40 border border-slate-800/80 rounded-xl"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: group.color || '#6366f1' }}
                      />
                      <div>
                        <div className="text-xs font-semibold text-slate-200">{group.name}</div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          <span>{group.members?.length || 0} members</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 rounded-xl transition"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
