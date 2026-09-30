import React, { useState } from 'react';
import { Search, Building, Briefcase, MessageSquare, Phone, UserPlus } from 'lucide-react';
import { useDirectory, OrganizationMember, useContacts } from '../hooks/useContacts';
import { PresenceBadge } from './PresenceBadge';

interface DirectoryViewProps {
  onStartCall: (targetUserId: string, callType: 'VOICE' | 'VIDEO') => void;
  onOpenConversation: (targetUserId: string) => void;
}

export const DirectoryView: React.FC<DirectoryViewProps> = ({
  onStartCall,
  onOpenConversation,
}) => {
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState('');

  const { data: members, isLoading } = useDirectory({
    search: search.trim() || undefined,
    department: selectedDept || undefined,
  });

  const { sendRequest } = useContacts();

  // Extract unique departments
  const departments = Array.from(
    new Set((members || []).map((m) => m.department).filter(Boolean)),
  ) as string[];

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="p-4 border-b border-slate-800/80 space-y-3 bg-slate-900/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold text-white tracking-tight">Organization Directory</h2>
            <span className="px-2 py-0.5 text-xs font-semibold text-slate-400 bg-slate-800 rounded-full">
              {members?.length || 0} members
            </span>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search directory by name, title, or username..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-900/80 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          {departments.length > 0 && (
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="px-3 py-2 text-xs bg-slate-900 border border-slate-800 rounded-xl text-slate-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Members Grid / List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        {isLoading ? (
          <div className="py-16 text-center text-slate-500 text-sm">Loading directory...</div>
        ) : !members || members.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-sm">
            <Building className="w-10 h-10 mx-auto mb-2 opacity-30" />
            No members found in directory
          </div>
        ) : (
          members.map((member: OrganizationMember) => (
            <div
              key={member.id}
              className="flex items-center justify-between p-3.5 bg-slate-900/60 hover:bg-slate-850/80 border border-slate-800/80 hover:border-slate-700/60 rounded-2xl transition shadow-sm"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-bold text-sm">
                    {member.displayName?.charAt(0).toUpperCase()}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 ring-2 ring-slate-900 rounded-full">
                    <PresenceBadge
                      status={member.presenceStatus}
                      availability={member.availability}
                      size="sm"
                    />
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-100 truncate">
                    {member.displayName}
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-1.5 truncate">
                    {member.jobTitle && (
                      <span className="flex items-center gap-1">
                        <Briefcase className="w-3 h-3 text-slate-500" />
                        {member.jobTitle}
                      </span>
                    )}
                    {member.department && (
                      <>
                        <span className="text-slate-600">•</span>
                        <span className="text-slate-500">{member.department}</span>
                      </>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                    @{member.username} ({member.nexaVoiceId})
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onOpenConversation(member.id)}
                  className="p-2 rounded-xl text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition"
                  title="Direct Message"
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onStartCall(member.id, 'VOICE')}
                  className="p-2 rounded-xl text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition"
                  title="Start Voice Call"
                >
                  <Phone className="w-4 h-4" />
                </button>
                <button
                  onClick={() => sendRequest(member.id)}
                  className="p-2 rounded-xl text-slate-400 hover:text-sky-400 hover:bg-slate-800 transition"
                  title="Add to Contacts"
                >
                  <UserPlus className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
