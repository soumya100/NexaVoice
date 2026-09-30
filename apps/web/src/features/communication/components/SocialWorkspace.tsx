import React, { useState } from 'react';
import {
  MessageSquare,
  Users,
  Building,
  Sparkles,
} from 'lucide-react';
import { useConversationsQuery, useCreateDirectConversation } from '../hooks/useConversations';
import { useMyPresence, PresenceStatus } from '../hooks/usePresence';
import { PresenceBadge } from './PresenceBadge';
import { NotificationCenter } from './NotificationCenter';
import { ConversationList } from './ConversationList';
import { ConversationView } from './ConversationView';
import { ContactList } from './ContactList';
import { DirectoryView } from './DirectoryView';
import { ContactRequestModal } from './ContactRequestModal';
import { ContactGroupsModal } from './ContactGroupsModal';
import { useInitiateCallMutation } from '../../calling/hooks/use-call-queries';
import { CallType } from '@nexavoice/domain-types';
import { toastService } from '../../../services/toast';

export interface SocialWorkspaceProps {
  initialTab?: 'MESSAGES' | 'CONTACTS' | 'DIRECTORY';
  initialConversationId?: string | null;
}

export const SocialWorkspace: React.FC<SocialWorkspaceProps> = ({
  initialTab = 'MESSAGES',
  initialConversationId = null,
}) => {
  const [activeTab, setActiveTab] = useState<'MESSAGES' | 'CONTACTS' | 'DIRECTORY'>(initialTab);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(initialConversationId);
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [isManageGroupsOpen, setIsManageGroupsOpen] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [customStatusInput, setCustomStatusInput] = useState('');

  // Keep state in sync with route navigation
  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  React.useEffect(() => {
    if (initialConversationId) {
      setSelectedConversationId(initialConversationId);
    }
  }, [initialConversationId]);

  const { data: conversations = [], isLoading: isLoadingConversations } = useConversationsQuery();
  const createDirectConv = useCreateDirectConversation();
  const initiateCallMutation = useInitiateCallMutation();
  const { presence, updateStatus } = useMyPresence();

  // Auto-select first conversation if none selected yet in Messages tab
  React.useEffect(() => {
    if (!selectedConversationId && conversations.length > 0 && activeTab === 'MESSAGES') {
      setSelectedConversationId(conversations[0].id);
    }
  }, [conversations, selectedConversationId, activeTab]);

  // Active conversation object
  const activeConversation = conversations.find((c) => c.id === selectedConversationId);

  // Handle direct call launch
  const handleStartCall = async (
    targetUserId: string,
    callType: 'VOICE' | 'VIDEO',
    conversationId?: string,
  ) => {
    try {
      const typeEnum = callType === 'VIDEO' ? CallType.VIDEO : CallType.VOICE;
      toastService.info(`Initiating ${callType.toLowerCase()} call...`);
      const call = await initiateCallMutation.mutateAsync({
        callType: typeEnum,
        inviteeUserIds: [targetUserId],
        conversationId,
      });
      toastService.success(`Call started (${call.id})`);
    } catch (err: any) {
      toastService.error(err.message || 'Failed to start call');
    }
  };

  // Handle open conversation with user
  const handleOpenConversationWithUser = async (targetUserId: string) => {
    try {
      const conv = await createDirectConv.mutateAsync(targetUserId);
      setSelectedConversationId(conv.id);
      setActiveTab('MESSAGES');
    } catch (err: any) {
      toastService.error(err.message || 'Failed to open conversation');
    }
  };

  const handleUpdateMyStatus = (status: PresenceStatus) => {
    updateStatus(status, customStatusInput || undefined);
    setShowStatusMenu(false);
  };

  return (
    <div className="social-workspace-container">
      {/* Primary Left Navigation Bar */}
      <div className="social-sidebar-nav">
        <div className="flex flex-col items-center gap-6">
          {/* NexaVoice Logo */}
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
            <Sparkles className="w-5 h-5 text-white" />
          </div>

          {/* Navigation Tab Icons */}
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => setActiveTab('MESSAGES')}
              className={`p-3 rounded-2xl transition-all ${
                activeTab === 'MESSAGES'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
              title="Messages"
            >
              <MessageSquare className="w-5 h-5" />
            </button>

            <button
              onClick={() => setActiveTab('CONTACTS')}
              className={`p-3 rounded-2xl transition-all ${
                activeTab === 'CONTACTS'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
              title="Contacts & Groups"
            >
              <Users className="w-5 h-5" />
            </button>

            <button
              onClick={() => setActiveTab('DIRECTORY')}
              className={`p-3 rounded-2xl transition-all ${
                activeTab === 'DIRECTORY'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
              title="Organization Directory"
            >
              <Building className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Bottom Bar: Notifications & Own Presence */}
        <div className="flex flex-col items-center gap-3">
          <NotificationCenter
            onNavigateToConversation={(convId) => {
              setSelectedConversationId(convId);
              setActiveTab('MESSAGES');
            }}
          />

          {/* User Presence Avatar & Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowStatusMenu(!showStatusMenu)}
              className="relative p-1 rounded-2xl hover:ring-2 hover:ring-indigo-500/50 transition"
              title="Your Presence & Status"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-xs shadow-inner">
                Me
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 ring-2 ring-slate-900 rounded-full">
                <PresenceBadge
                  status={presence?.status || 'ONLINE'}
                  availability={presence?.availability}
                  size="sm"
                />
              </div>
            </button>

            {/* Status Picker Menu */}
            {showStatusMenu && (
              <div className="absolute left-12 bottom-0 w-64 p-3 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl backdrop-blur-xl z-50 text-slate-100 space-y-3">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Set Your Presence
                </div>

                <div className="space-y-1 text-xs">
                  {(['ONLINE', 'BUSY', 'AWAY', 'OFFLINE'] as PresenceStatus[]).map((st) => (
                    <button
                      key={st}
                      onClick={() => handleUpdateMyStatus(st)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl transition ${
                        presence?.status === st
                          ? 'bg-indigo-600/20 text-white font-semibold'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <PresenceBadge status={st} size="sm" />
                      <span className="capitalize">{st.toLowerCase()}</span>
                    </button>
                  ))}
                </div>

                <div className="pt-2 border-t border-slate-800">
                  <input
                    type="text"
                    placeholder="Custom status message..."
                    value={customStatusInput}
                    onChange={(e) => setCustomStatusInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        updateStatus(presence?.status || 'ONLINE', customStatusInput);
                        setShowStatusMenu(false);
                      }
                    }}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Primary Workspace Area */}
      <div className="flex-1 flex overflow-hidden">
        {activeTab === 'MESSAGES' ? (
          <>
            {/* Conversation Drawer */}
            <div className="w-80 md:w-96 flex-shrink-0 h-full">
              <ConversationList
                conversations={conversations}
                selectedId={selectedConversationId}
                onSelect={(id) => setSelectedConversationId(id)}
                isLoading={isLoadingConversations}
                onNewConversation={() => setActiveTab('CONTACTS')}
              />
            </div>

            {/* Conversation Timeline */}
            <div className="flex-1 h-full min-w-0 flex flex-col">
              {activeConversation ? (
                <ConversationView
                  conversation={activeConversation}
                  onStartCall={handleStartCall}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 p-8 text-center">
                  <div className="w-16 h-16 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-4 shadow-inner">
                    <MessageSquare className="w-8 h-8 text-indigo-400 opacity-60" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-200">Select a Conversation</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    Choose an existing conversation from the left drawer or pick a contact to begin messaging and calling.
                  </p>
                </div>
              )}
            </div>
          </>
        ) : activeTab === 'CONTACTS' ? (
          <div className="flex-1 h-full w-full max-w-5xl mx-auto overflow-hidden">
            <ContactList
              onStartCall={handleStartCall}
              onOpenConversation={handleOpenConversationWithUser}
              onOpenAddContact={() => setIsAddContactOpen(true)}
              onOpenManageGroups={() => setIsManageGroupsOpen(true)}
            />
          </div>
        ) : (
          <div className="flex-1 h-full w-full max-w-5xl mx-auto overflow-hidden">
            <DirectoryView
              onStartCall={handleStartCall}
              onOpenConversation={handleOpenConversationWithUser}
            />
          </div>
        )}
      </div>

      {/* Modals */}
      <ContactRequestModal
        isOpen={isAddContactOpen}
        onClose={() => setIsAddContactOpen(false)}
      />

      <ContactGroupsModal
        isOpen={isManageGroupsOpen}
        onClose={() => setIsManageGroupsOpen(false)}
      />
    </div>
  );
};
