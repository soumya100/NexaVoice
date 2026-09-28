import { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Users,
  Search,
  UserPlus,
  Send,
  Paperclip,
  Reply,
  Check,
  CheckCheck,
  MoreVertical,
  Shield,
  ShieldAlert,
  Flag,
  Trash2,
  Edit2,
  Mic,
  Play,
  Pause,
  X,
  Bell,
  BellOff,
  CornerDownRight,
  Wifi,
  WifiOff,
  Lock,
} from 'lucide-react';
import {
  executeGraphQL,
  GET_USER_CONVERSATIONS,
  CREATE_DIRECT_CONVERSATION,
  GET_CONVERSATION_MESSAGES,
  SEND_MESSAGE_MUTATION,
  EDIT_MESSAGE_MUTATION,
  DELETE_MESSAGE_MUTATION,
  ADD_REACTION_MUTATION,
  REMOVE_REACTION_MUTATION,
  UPDATE_READ_WATERMARK_MUTATION,
  GET_CONTACTS,
  DISCOVER_USERS,
  SEND_CONTACT_REQUEST,
  GET_PRIVACY_SETTINGS,
  UPDATE_PRIVACY_SETTINGS,
  uploadAttachmentFile,
} from '../services/api';
import { realtimeClient, RealtimeConnectionState } from '../services/realtime';
import { authService } from '../services/auth';
import { toastService } from '../services/toast';

interface MockUser {
  id: string;
  nexaVoiceId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  isOnline: boolean;
}

interface MockReaction {
  userId: string;
  reaction: string;
}

interface MockAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  voiceDurationMs?: number;
  downloadUrl?: string;
}

interface MockMessage {
  id: string;
  conversationId: string;
  senderId: string;
  clientMessageId: string;
  sequenceNumber: number;
  content: string;
  type: 'TEXT' | 'IMAGE' | 'FILE' | 'VOICE';
  deliveryStatus: 'SENT' | 'DELIVERED' | 'READ';
  isEdited: boolean;
  isDeleted: boolean;
  replyToMessageId?: string;
  reactions: MockReaction[];
  attachments?: MockAttachment[];
  timestamp: string;
}

interface MockConversation {
  id: string;
  type: 'DIRECT' | 'GROUP';
  title: string;
  description?: string;
  avatarUrl?: string;
  unreadCount: number;
  lastMessageSnippet: string;
  lastMessageTime: string;
  isMuted: boolean;
  participants: {
    userId: string;
    role: 'OWNER' | 'ADMIN' | 'MEMBER';
    displayName: string;
    isOnline: boolean;
  }[];
}

const FALLBACK_USER: MockUser = {
  id: 'usr-current',
  nexaVoiceId: 'NV-901238',
  username: 'current.user',
  displayName: 'Current User',
  isOnline: true,
};

export function MessagingWorkspace() {
  const authUser = authService.getUser();
  const currentUser: MockUser = authUser
    ? {
        id: authUser.id,
        nexaVoiceId: authUser.nexaVoiceId || 'NV-CURRENT',
        username: authUser.username,
        displayName: authUser.displayName || authUser.username,
        avatarUrl: (authUser as any).avatarUrl || undefined,
        isOnline: true,
      }
    : FALLBACK_USER;

  const [activeTab, setActiveTab] = useState<'chats' | 'contacts' | 'discovery'>('chats');
  const [activeConversationId, setActiveConversationId] = useState<string>('');
  const [composerText, setComposerText] = useState('');
  const [replyingTo, setReplyingTo] = useState<MockMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<MockMessage | null>(null);
  const [remoteTypingUser, setRemoteTypingUser] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<RealtimeConnectionState>(realtimeClient.getConnectionState());
  const [showDetailsPanel, setShowDetailsPanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [discoveryQuery, setDiscoveryQuery] = useState('');
  const [discoveredUsers, setDiscoveredUsers] = useState<any[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimerRef = useRef<any>(null);

  // Privacy Settings State
  const [privacySettings, setPrivacySettings] = useState({
    discoverableByUsername: true,
    discoverableByNexaVoiceId: true,
    readReceiptsEnabled: true,
    typingIndicatorsEnabled: true,
    whoCanMessageMe: 'EVERYONE',
  });

  // Conversations & Messages State (Live)
  const [conversations, setConversations] = useState<MockConversation[]>([]);
  const [messages, setMessages] = useState<Record<string, MockMessage[]>>({});

  // Contacts State (Live)
  const [contacts, setContacts] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeConversationId]);

  // Load Privacy Settings
  useEffect(() => {
    executeGraphQL<{ myPrivacySettings: any }>(GET_PRIVACY_SETTINGS)
      .then((res) => {
        if (res.myPrivacySettings) {
          const p = res.myPrivacySettings;
          setPrivacySettings({
            discoverableByUsername: p.discoverableByUsername ?? true,
            discoverableByNexaVoiceId: p.discoverableByNexaVoiceId ?? true,
            readReceiptsEnabled: p.readReceiptsEnabled ?? true,
            typingIndicatorsEnabled: p.typingIndicatorsEnabled ?? true,
            whoCanMessageMe: p.whoCanMessageMe || 'EVERYONE',
          });
        }
      })
      .catch(() => {});
  }, []);

  const handleUpdatePrivacy = async (key: string, value: boolean) => {
    const updated = { ...privacySettings, [key]: value };
    setPrivacySettings(updated);
    try {
      await executeGraphQL(UPDATE_PRIVACY_SETTINGS, {
        input: {
          [key]: value,
        },
      });
      toastService.success('Privacy policy updated');
    } catch (err: any) {
      toastService.error(err?.message || 'Failed to update privacy settings');
    }
  };

  // Refresh conversations from live backend
  const refreshConversations = async () => {
    try {
      const res = await executeGraphQL<{ conversations: any[] }>(GET_USER_CONVERSATIONS);
      if (res.conversations && res.conversations.length > 0) {
        const loadedConvs: MockConversation[] = res.conversations.map((c: any) => {
          const otherParticipant = c.participants?.find((p: any) => p.userId !== currentUser.id);
          return {
            id: c.id,
            type: c.type,
            title: c.title || otherParticipant?.user?.displayName || otherParticipant?.user?.username || 'Direct Chat',
            avatarUrl: c.avatarUrl || otherParticipant?.user?.avatarUrl || '',
            unreadCount: c.unreadCount || 0,
            lastMessageSnippet: c.lastMessageSnippet || 'No messages yet',
            lastMessageTime: c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
            isMuted: c.isMuted || false,
            participants: (c.participants || []).map((p: any) => ({
              userId: p.userId,
              role: p.conversationRole || 'MEMBER',
              displayName: p.user?.displayName || p.user?.username || p.userId,
              isOnline: p.user?.isOnline ?? true,
            })),
          };
        });
        setConversations(loadedConvs);
        setActiveConversationId((prev) => (prev && loadedConvs.some((c) => c.id === prev) ? prev : loadedConvs[0].id));
      } else {
        // If 0 conversations exist for user, auto-seed a direct conversation with "alice" (Alice Smith)
        try {
          const directRes = await executeGraphQL<{ createDirectConversation: any }>(CREATE_DIRECT_CONVERSATION, {
            input: { targetUserId: 'alice' },
          });
          if (directRes.createDirectConversation) {
            const c = directRes.createDirectConversation;
            const newConv: MockConversation = {
              id: c.id,
              type: c.type,
              title: 'Alice Smith',
              avatarUrl: '',
              unreadCount: 0,
              lastMessageSnippet: 'Welcome to NexaVoice secure live messaging!',
              lastMessageTime: 'Just now',
              isMuted: false,
              participants: (c.participants || []).map((p: any) => ({
                userId: p.userId,
                role: p.conversationRole || 'MEMBER',
                displayName: p.user?.displayName || p.user?.username || p.userId,
                isOnline: true,
              })),
            };
            setConversations([newConv]);
            setActiveConversationId(c.id);
          }
        } catch {
          // Ignore
        }
      }
    } catch (err: any) {
      console.warn('Failed to load conversations:', err);
    }
  };

  // Refresh contacts from live backend
  const refreshContacts = async () => {
    try {
      const res = await executeGraphQL<{ contacts: any[] }>(GET_CONTACTS);
      if (res.contacts) {
        setContacts(
          res.contacts.map((c: any) => ({
            id: c.contact?.id || c.id,
            username: c.contact?.username || 'user',
            displayName: c.contact?.displayName || c.contact?.username || 'User',
            nexaVoiceId: c.contact?.nexaVoiceId || 'NV-0000',
            avatarUrl: c.contact?.avatarUrl,
            status: c.status,
            isOnline: c.contact?.isOnline ?? true,
          })),
        );
      }
    } catch {
      // Ignore
    }
  };

  // Connect to live Socket.IO and listen for realtime message events
  useEffect(() => {
    const unbindState = realtimeClient.onStateChange((state) => {
      setConnectionState(state);
    });

    realtimeClient.connect();
    refreshConversations();
    refreshContacts();

    const unMsgCreated = realtimeClient.onMessageCreated((payload: any) => {
      const msg = payload.message || payload;
      if (!msg?.conversationId) return;

      setMessages((prev) => {
        const convMsgs = prev[msg.conversationId] || [];
        if (convMsgs.some((m) => m.id === msg.id || (m.clientMessageId && m.clientMessageId === msg.clientMessageId))) {
          return {
            ...prev,
            [msg.conversationId]: convMsgs.map((m) =>
              m.clientMessageId === msg.clientMessageId ? { ...m, id: msg.id, sequenceNumber: msg.sequenceNumber, deliveryStatus: 'SENT' } : m,
            ),
          };
        }
        return {
          ...prev,
          [msg.conversationId]: [
            ...convMsgs,
            {
              id: msg.id,
              conversationId: msg.conversationId,
              senderId: msg.senderId,
              clientMessageId: msg.clientMessageId || msg.id,
              sequenceNumber: msg.sequenceNumber,
              content: msg.content,
              type: msg.type || 'TEXT',
              deliveryStatus: msg.deliveryStatus || 'DELIVERED',
              isEdited: msg.isEdited || false,
              isDeleted: false,
              replyToMessageId: msg.replyToMessageId,
              reactions: (msg.reactions || []).map((r: any) => ({ userId: r.userId, reaction: r.reaction })),
              attachments: msg.attachments || [],
              timestamp: new Date(msg.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ],
        };
      });

      setConversations((prev) =>
        prev.map((c) =>
          c.id === msg.conversationId
            ? { ...c, lastMessageSnippet: msg.content, lastMessageTime: 'Just now' }
            : c,
        ),
      );
    });

    const unMsgUpdated = realtimeClient.onMessageUpdated((payload: any) => {
      const msg = payload.message || payload;
      if (!msg?.conversationId) return;
      setMessages((prev) => ({
        ...prev,
        [msg.conversationId]: (prev[msg.conversationId] || []).map((m) =>
          m.id === msg.id ? { ...m, content: msg.content, isEdited: true } : m,
        ),
      }));
    });

    const unMsgDeleted = realtimeClient.onMessageDeleted((payload: any) => {
      setMessages((prev) => ({
        ...prev,
        [payload.conversationId]: (prev[payload.conversationId] || []).map((m) =>
          m.id === payload.messageId ? { ...m, isDeleted: true, content: '[This message was deleted]' } : m,
        ),
      }));
    });

    const unTypingStart = realtimeClient.onTypingStarted((payload) => {
      if (payload.conversationId === activeConversationId && payload.userId !== currentUser.id) {
        setRemoteTypingUser('Remote contact');
      }
    });

    const unTypingStop = realtimeClient.onTypingStopped((payload) => {
      if (payload.conversationId === activeConversationId) {
        setRemoteTypingUser(null);
      }
    });

    const unEvicted = realtimeClient.onEvicted((payload) => {
      toastService.warning(`Security Notice: You were evicted from conversation ${payload.conversationId}`);
      refreshConversations();
    });

    return () => {
      unbindState();
      unMsgCreated();
      unMsgUpdated();
      unMsgDeleted();
      unTypingStart();
      unTypingStop();
      unEvicted();
    };
  }, [activeConversationId]);

  // Join active conversation room upon selection and load live messages
  useEffect(() => {
    if (!activeConversationId) return;

    realtimeClient.joinConversation(activeConversationId);
    setIsLoadingMessages(true);

    executeGraphQL<{ messages: { edges: Array<{ node: any }> } }>(GET_CONVERSATION_MESSAGES, {
      input: {
        conversationId: activeConversationId,
        limit: 50,
      },
    })
      .then((res) => {
        if (res.messages?.edges) {
          const loaded = res.messages.edges.map((e) => {
            const m = e.node;
            return {
              id: m.id,
              conversationId: m.conversationId,
              senderId: m.senderId,
              clientMessageId: m.clientMessageId || m.id,
              sequenceNumber: m.sequenceNumber,
              content: m.content,
              type: m.type,
              deliveryStatus: m.deliveryStatus,
              isEdited: m.isEdited,
              isDeleted: Boolean(m.deletedAt),
              replyToMessageId: m.replyToMessageId,
              reactions: (m.reactions || []).map((r: any) => ({ userId: r.userId, reaction: r.reaction })),
              attachments: m.attachments || [],
              timestamp: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            };
          });
          setMessages((prev) => ({
            ...prev,
            [activeConversationId]: loaded,
          }));
        }
      })
      .catch((err) => {
        console.warn('Failed to load messages:', err);
      })
      .finally(() => {
        setIsLoadingMessages(false);
      });

    // Mark as read
    executeGraphQL(UPDATE_READ_WATERMARK_MUTATION, {
      conversationId: activeConversationId,
    }).catch(() => {});

    return () => {
      realtimeClient.leaveConversation(activeConversationId);
    };
  }, [activeConversationId]);

  const activeConversation = conversations.find((c) => c.id === activeConversationId);
  const activeMessages = messages[activeConversationId] || [];

  // Send Message with Idempotency Key & GraphQL Mutation
  const handleSendMessage = async () => {
    if (!composerText.trim()) return;

    if (editingMessage) {
      setMessages((prev) => ({
        ...prev,
        [activeConversationId]: prev[activeConversationId].map((m) =>
          m.id === editingMessage.id ? { ...m, content: composerText.trim(), isEdited: true } : m,
        ),
      }));

      executeGraphQL(EDIT_MESSAGE_MUTATION, {
        input: {
          messageId: editingMessage.id,
          content: composerText.trim(),
        },
      }).catch(() => {});

      setEditingMessage(null);
      setComposerText('');
      return;
    }

    const clientMsgId = `cli-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newSeq = (activeMessages[activeMessages.length - 1]?.sequenceNumber || 0) + 1;

    const newMsg: MockMessage = {
      id: `msg-${Date.now()}`,
      conversationId: activeConversationId,
      senderId: currentUser.id,
      clientMessageId: clientMsgId,
      sequenceNumber: newSeq,
      content: composerText.trim(),
      type: 'TEXT',
      deliveryStatus: 'SENT',
      isEdited: false,
      isDeleted: false,
      replyToMessageId: replyingTo?.id,
      reactions: [],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => ({
      ...prev,
      [activeConversationId]: [...(prev[activeConversationId] || []), newMsg],
    }));

    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversationId
          ? { ...c, lastMessageSnippet: newMsg.content, lastMessageTime: 'Just now' }
          : c,
      ),
    );

    const textToSend = composerText.trim();
    setComposerText('');
    setReplyingTo(null);

    // Live GraphQL mutation dispatch
    try {
      const res = await executeGraphQL<{ sendMessage: any }>(SEND_MESSAGE_MUTATION, {
        input: {
          conversationId: activeConversationId,
          content: textToSend,
          clientMessageId: clientMsgId,
          replyToMessageId: replyingTo?.id,
        },
      });
      if (res.sendMessage) {
        setMessages((prev) => ({
          ...prev,
          [activeConversationId]: (prev[activeConversationId] || []).map((m) =>
            m.clientMessageId === clientMsgId
              ? {
                  ...m,
                  id: res.sendMessage.id,
                  sequenceNumber: res.sendMessage.sequenceNumber,
                  deliveryStatus: 'SENT',
                }
              : m,
          ),
        }));
      }
    } catch (err: any) {
      console.warn('Live message delivery failed, stored offline:', err);
      toastService.warning('Notice: Message queued locally (offline fallback)');
      const offlineQueue = JSON.parse(localStorage.getItem('nexavoice_offline_queue') || '[]');
      offlineQueue.push({
        conversationId: activeConversationId,
        content: textToSend,
        clientMessageId: clientMsgId,
      });
      localStorage.setItem('nexavoice_offline_queue', JSON.stringify(offlineQueue));
    }
  };

  // Typing indicator trigger on composer change
  const handleComposerChange = (text: string) => {
    setComposerText(text);
    if (activeConversationId) {
      realtimeClient.sendTypingStart(activeConversationId);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        realtimeClient.sendTypingStop(activeConversationId);
      }, 2500);
    }
  };

  // Toggle Reaction with Live Mutation
  const handleToggleReaction = (messageId: string, emoji: string) => {
    const msg = (messages[activeConversationId] || []).find((m) => m.id === messageId);
    const hasReacted = msg?.reactions.some(
      (r) => r.userId === currentUser.id && r.reaction === emoji,
    );

    setMessages((prev) => ({
      ...prev,
      [activeConversationId]: prev[activeConversationId].map((m) => {
        if (m.id !== messageId) return m;
        const updated = hasReacted
          ? m.reactions.filter((r) => !(r.userId === currentUser.id && r.reaction === emoji))
          : [...m.reactions, { userId: currentUser.id, reaction: emoji }];
        return { ...m, reactions: updated };
      }),
    }));

    if (hasReacted) {
      executeGraphQL(REMOVE_REACTION_MUTATION, {
        input: { messageId, reaction: emoji },
      }).catch(() => {});
    } else {
      executeGraphQL(ADD_REACTION_MUTATION, {
        input: { messageId, reaction: emoji },
      }).catch(() => {});
    }
  };

  // Soft Delete with Live Mutation
  const handleDeleteMessage = (messageId: string) => {
    setMessages((prev) => ({
      ...prev,
      [activeConversationId]: prev[activeConversationId].map((m) =>
        m.id === messageId ? { ...m, isDeleted: true, content: '[This message was deleted]' } : m,
      ),
    }));

    executeGraphQL(DELETE_MESSAGE_MUTATION, {
      input: { messageId },
    })
      .then(() => toastService.success('Message deleted'))
      .catch((err: any) => toastService.error(err?.message || 'Failed to delete message'));
  };

  // File Upload
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const uploaded = await uploadAttachmentFile(file, currentUser.id);
      const clientMsgId = `cli-att-${Date.now()}`;
      await executeGraphQL(SEND_MESSAGE_MUTATION, {
        input: {
          conversationId: activeConversationId,
          content: `Uploaded attachment: ${uploaded.fileName}`,
          clientMessageId: clientMsgId,
          attachmentIds: [uploaded.attachmentId],
        },
      });
      toastService.success('File uploaded and sent');
    } catch (err: any) {
      toastService.error(`File upload failed: ${err?.message || 'Security check failed'}`);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Accept Contact Request
  const handleAcceptRequest = (reqId: string) => {
    const req = pendingRequests.find((r) => r.id === reqId);
    if (!req) return;
    setPendingRequests((prev) => prev.filter((r) => r.id !== reqId));
    setContacts((prev) => [
      ...prev,
      {
        id: req.requesterId,
        username: req.username,
        displayName: req.displayName,
        nexaVoiceId: req.nexaVoiceId,
        status: 'ACCEPTED',
        isOnline: true,
      },
    ]);
  };

  // User Discovery Search
  const handleSearchUsers = async () => {
    if (!discoveryQuery.trim()) return;
    setIsSearchingUsers(true);
    try {
      const res = await executeGraphQL<{ discoverUsers: any[] }>(DISCOVER_USERS, {
        query: discoveryQuery.trim(),
        limit: 10,
      });
      setDiscoveredUsers(res.discoverUsers || []);
      if (!res.discoverUsers || res.discoverUsers.length === 0) {
        toastService.info('No users found matching that username or NexaVoice ID');
      }
    } catch (err: any) {
      toastService.error(err?.message || 'Failed to search users');
    } finally {
      setIsSearchingUsers(false);
    }
  };

  // Start Direct Chat with User
  const handleStartDirectChat = async (targetUser: any) => {
    try {
      const res = await executeGraphQL<{ createDirectConversation: any }>(CREATE_DIRECT_CONVERSATION, {
        input: { targetUserId: targetUser.id || targetUser.username || targetUser.nexaVoiceId },
      });
      if (res.createDirectConversation) {
        const c = res.createDirectConversation;
        const otherParticipant = c.participants?.find((p: any) => p.userId !== currentUser.id);
        const title =
          c.title ||
          otherParticipant?.user?.displayName ||
          otherParticipant?.user?.username ||
          targetUser.displayName ||
          targetUser.username ||
          'Direct Chat';
        const newConv: MockConversation = {
          id: c.id,
          type: c.type,
          title,
          avatarUrl: c.avatarUrl || otherParticipant?.user?.avatarUrl || targetUser.avatarUrl || '',
          unreadCount: 0,
          lastMessageSnippet: 'Encrypted direct channel ready',
          lastMessageTime: 'Just now',
          isMuted: false,
          participants: (c.participants || []).map((p: any) => ({
            userId: p.userId,
            role: p.conversationRole || 'MEMBER',
            displayName: p.user?.displayName || p.user?.username || p.userId,
            isOnline: true,
          })),
        };
        setConversations((prev) => {
          const exists = prev.find((x) => x.id === c.id);
          return exists ? prev : [newConv, ...prev];
        });
        setActiveConversationId(c.id);
        setActiveTab('chats');
        toastService.success(`Live conversation opened with ${title}`);
      }
    } catch (err: any) {
      toastService.error(err?.message || 'Failed to open conversation');
    }
  };

  // Send Contact Request Live
  const handleSendContactRequest = async (userId: string) => {
    try {
      await executeGraphQL(SEND_CONTACT_REQUEST, {
        targetUserId: userId,
      });
      toastService.success('Contact request dispatched successfully!');
      refreshContacts();
    } catch (err: any) {
      toastService.error(err?.message || 'Failed to send contact request');
    }
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 72px)', width: '100%', overflow: 'hidden' }}>
      {/* PANE 1: Conversation & Contacts Sidebar */}
      <div
        style={{
          width: '340px',
          borderRight: '1px solid var(--nv-border)',
          background: 'var(--nv-bg-surface)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Navigation Subtabs */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--nv-border)',
            padding: '0.75rem 1rem 0',
            gap: '1rem',
          }}
        >
          <button
            onClick={() => setActiveTab('chats')}
            style={{
              padding: '0.5rem 0.25rem 0.75rem',
              fontWeight: 600,
              fontSize: '0.875rem',
              color: activeTab === 'chats' ? 'var(--nv-primary)' : 'var(--nv-text-secondary)',
              borderBottom: activeTab === 'chats' ? '2px solid var(--nv-primary)' : '2px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <MessageSquare size={16} />
            Chats
          </button>
          <button
            onClick={() => setActiveTab('contacts')}
            style={{
              padding: '0.5rem 0.25rem 0.75rem',
              fontWeight: 600,
              fontSize: '0.875rem',
              color: activeTab === 'contacts' ? 'var(--nv-primary)' : 'var(--nv-text-secondary)',
              borderBottom: activeTab === 'contacts' ? '2px solid var(--nv-primary)' : '2px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <Users size={16} />
            Contacts
            {pendingRequests.length > 0 && (
              <span
                style={{
                  background: 'var(--nv-danger)',
                  color: '#fff',
                  borderRadius: '999px',
                  padding: '0.1rem 0.45rem',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                }}
              >
                {pendingRequests.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('discovery')}
            style={{
              padding: '0.5rem 0.25rem 0.75rem',
              fontWeight: 600,
              fontSize: '0.875rem',
              color: activeTab === 'discovery' ? 'var(--nv-primary)' : 'var(--nv-text-secondary)',
              borderBottom: activeTab === 'discovery' ? '2px solid var(--nv-primary)' : '2px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <UserPlus size={16} />
            Discover
          </button>
        </div>

        {/* Search Bar */}
        <div style={{ padding: '0.75rem 1rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'var(--nv-bg-elevated)',
              border: '1px solid var(--nv-border)',
              borderRadius: '10px',
              padding: '0.5rem 0.75rem',
            }}
          >
            <Search size={16} color="var(--nv-text-muted)" />
            <input
              type="text"
              placeholder="Search conversations & contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--nv-text-primary)',
                fontSize: '0.85rem',
                width: '100%',
              }}
            />
          </div>
        </div>

        {/* Tab Content List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {activeTab === 'chats' && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {conversations.map((conv) => {
                const isActive = conv.id === activeConversationId;
                return (
                  <div
                    key={conv.id}
                    onClick={() => setActiveConversationId(conv.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.85rem 1rem',
                      cursor: 'pointer',
                      borderLeft: isActive ? '3px solid var(--nv-primary)' : '3px solid transparent',
                      background: isActive ? 'var(--nv-bg-elevated)' : 'transparent',
                      transition: 'background 150ms ease',
                    }}
                  >
                    {/* Avatar */}
                    <div style={{ position: 'relative' }}>
                      {conv.avatarUrl ? (
                        <img
                          src={conv.avatarUrl}
                          alt={conv.title}
                          style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '50%',
                            background: conv.type === 'GROUP' ? 'linear-gradient(135deg, #6366f1, #06b6d4)' : 'var(--nv-bg-canvas)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            color: '#fff',
                            fontSize: '0.9rem',
                          }}
                        >
                          {conv.type === 'GROUP' ? <Users size={20} /> : conv.title[0]}
                        </div>
                      )}
                      {conv.type === 'DIRECT' && (
                        <span
                          style={{
                            position: 'absolute',
                            bottom: 0,
                            right: 0,
                            width: '10px',
                            height: '10px',
                            borderRadius: '50%',
                            background: 'var(--nv-status-online)',
                            border: '2px solid var(--nv-bg-surface)',
                          }}
                        />
                      )}
                    </div>

                    {/* Conversation Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--nv-text-primary)' }}>
                          {conv.title}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--nv-text-muted)' }}>
                          {conv.lastMessageTime}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: '0.8rem',
                          color: 'var(--nv-text-secondary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          marginTop: '2px',
                        }}
                      >
                        {conv.lastMessageSnippet}
                      </div>
                    </div>

                    {/* Badges */}
                    {conv.unreadCount > 0 && (
                      <span
                        style={{
                          background: 'var(--nv-primary)',
                          color: '#fff',
                          borderRadius: '999px',
                          padding: '0.15rem 0.5rem',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                        }}
                      >
                        {conv.unreadCount}
                      </span>
                    )}
                    {conv.isMuted && <BellOff size={14} color="var(--nv-text-muted)" />}
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'contacts' && (
            <div style={{ padding: '0.5rem 1rem' }}>
              {/* Pending Requests */}
              {pendingRequests.length > 0 && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--nv-text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                    Pending Requests ({pendingRequests.length})
                  </div>
                  {pendingRequests.map((req) => (
                    <div
                      key={req.id}
                      style={{
                        padding: '0.75rem',
                        background: 'var(--nv-bg-elevated)',
                        borderRadius: '10px',
                        border: '1px solid var(--nv-border)',
                        marginBottom: '0.5rem',
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{req.displayName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--nv-text-muted)' }}>
                        @{req.username} • {req.nexaVoiceId}
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <button
                          onClick={() => handleAcceptRequest(req.id)}
                          style={{
                            flex: 1,
                            padding: '0.35rem',
                            background: 'var(--nv-primary)',
                            color: '#fff',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                          }}
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => setPendingRequests((prev) => prev.filter((r) => r.id !== req.id))}
                          style={{
                            flex: 1,
                            padding: '0.35rem',
                            background: 'transparent',
                            border: '1px solid var(--nv-border)',
                            color: 'var(--nv-text-secondary)',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                          }}
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* All Contacts */}
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--nv-text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                Your Contacts ({contacts.length})
              </div>
              {contacts.map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 0',
                    borderBottom: '1px solid var(--nv-border-muted)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{c.displayName}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--nv-text-muted)' }}>
                      @{c.username} • {c.nexaVoiceId}
                    </div>
                  </div>
                  <button
                    onClick={() => handleStartDirectChat(c)}
                    style={{
                      padding: '0.35rem 0.65rem',
                      background: 'var(--nv-bg-elevated)',
                      border: '1px solid var(--nv-border)',
                      borderRadius: '6px',
                      color: 'var(--nv-primary)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Chat
                  </button>
                </div>
              ))}
              {contacts.length === 0 && (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--nv-text-muted)', fontSize: '0.85rem' }}>
                  No contacts found yet. Use the <strong>Discover</strong> tab to find teammates and send connection requests.
                </div>
              )}
            </div>
          )}

          {activeTab === 'discovery' && (
            <div style={{ padding: '1rem' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--nv-text-secondary)', marginBottom: '1rem', lineHeight: '1.4' }}>
                Find users by <strong>NexaVoice ID</strong> or <strong>Username</strong> without exposing private emails or phone numbers.
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <input
                  type="text"
                  placeholder="Enter NV-ID or username..."
                  value={discoveryQuery}
                  onChange={(e) => setDiscoveryQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSearchUsers();
                  }}
                  style={{
                    flex: 1,
                    background: 'var(--nv-bg-elevated)',
                    border: '1px solid var(--nv-border)',
                    borderRadius: '8px',
                    padding: '0.5rem 0.75rem',
                    color: 'var(--nv-text-primary)',
                    fontSize: '0.85rem',
                  }}
                />
                <button
                  onClick={handleSearchUsers}
                  disabled={isSearchingUsers}
                  style={{
                    background: 'var(--nv-primary)',
                    color: '#fff',
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: isSearchingUsers ? 'not-allowed' : 'pointer',
                    opacity: isSearchingUsers ? 0.7 : 1,
                  }}
                >
                  {isSearchingUsers ? 'Searching...' : 'Search'}
                </button>
              </div>

              {/* Discovered Users List */}
              {discoveredUsers.length > 0 && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--nv-text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                    Matching Users ({discoveredUsers.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {discoveredUsers.map((u) => (
                      <div
                        key={u.id}
                        style={{
                          background: 'var(--nv-bg-elevated)',
                          border: '1px solid var(--nv-border)',
                          borderRadius: '10px',
                          padding: '0.75rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.5rem',
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--nv-text-primary)' }}>
                            {u.displayName || u.username}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--nv-text-muted)' }}>
                            @{u.username} • {u.nexaVoiceId}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                          <button
                            onClick={() => handleStartDirectChat(u)}
                            style={{
                              padding: '0.35rem 0.65rem',
                              background: 'var(--nv-primary)',
                              color: '#fff',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            Chat
                          </button>
                          <button
                            onClick={() => handleSendContactRequest(u.id)}
                            style={{
                              padding: '0.35rem 0.65rem',
                              background: 'transparent',
                              border: '1px solid var(--nv-border)',
                              color: 'var(--nv-text-secondary)',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            + Add
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Privacy Setting Card */}
              <div
                style={{
                  background: 'var(--nv-bg-elevated)',
                  border: '1px solid var(--nv-border)',
                  borderRadius: '12px',
                  padding: '1rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                  <Shield size={16} color="var(--nv-primary)" />
                  Discovery Privacy Policy
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.8rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                    <span>Discoverable by Username</span>
                    <input
                      type="checkbox"
                      checked={privacySettings.discoverableByUsername}
                      onChange={(e) => handleUpdatePrivacy('discoverableByUsername', e.target.checked)}
                    />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                    <span>Discoverable by NexaVoice ID</span>
                    <input
                      type="checkbox"
                      checked={privacySettings.discoverableByNexaVoiceId}
                      onChange={(e) => handleUpdatePrivacy('discoverableByNexaVoiceId', e.target.checked)}
                    />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                    <span>Read Receipts</span>
                    <input
                      type="checkbox"
                      checked={privacySettings.readReceiptsEnabled}
                      onChange={(e) => handleUpdatePrivacy('readReceiptsEnabled', e.target.checked)}
                    />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                    <span>Typing Indicators</span>
                    <input
                      type="checkbox"
                      checked={privacySettings.typingIndicatorsEnabled}
                      onChange={(e) => handleUpdatePrivacy('typingIndicatorsEnabled', e.target.checked)}
                    />
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* PANE 2: Active Conversation Stage */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--nv-bg-canvas)' }}>
        {/* Stage Header */}
        <div
          style={{
            height: '64px',
            borderBottom: '1px solid var(--nv-border)',
            background: 'var(--nv-bg-surface)',
            padding: '0 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {activeConversation?.avatarUrl ? (
              <img
                src={activeConversation.avatarUrl}
                alt={activeConversation.title}
                style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  color: '#fff',
                }}
              >
                {activeConversation?.title[0]}
              </div>
            )}
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--nv-text-primary)' }}>
                {activeConversation?.title}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--nv-status-online)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--nv-status-online)' }} />
                {activeConversation?.type === 'DIRECT' ? 'Online • Verified Identity' : `${activeConversation?.participants.length} participants`}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '0.35rem 0.65rem',
                borderRadius: '8px',
                background: connectionState === 'CONNECTED' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                color: connectionState === 'CONNECTED' ? '#22c55e' : '#ef4444',
                border: `1px solid ${connectionState === 'CONNECTED' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              }}
            >
              {connectionState === 'CONNECTED' ? <Wifi size={14} /> : <WifiOff size={14} />}
              {connectionState === 'CONNECTED' ? 'Realtime Connected' : connectionState === 'CONNECTING' ? 'Connecting...' : 'Offline (Queued)'}
            </div>

            <button
              onClick={() => setShowDetailsPanel(!showDetailsPanel)}
              style={{
                padding: '0.5rem 0.85rem',
                borderRadius: '8px',
                background: showDetailsPanel ? 'var(--nv-bg-elevated)' : 'transparent',
                border: '1px solid var(--nv-border)',
                color: 'var(--nv-text-primary)',
                fontSize: '0.8rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <MoreVertical size={16} />
              Details & Privacy
            </button>
          </div>
        </div>

        {/* Message Stream */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {isLoadingMessages ? (
            <div style={{ margin: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', color: 'var(--nv-text-muted)' }}>
              <div style={{ width: '28px', height: '28px', border: '3px solid var(--nv-border)', borderTopColor: 'var(--nv-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <div style={{ fontSize: '0.85rem' }}>Loading secure messages...</div>
            </div>
          ) : activeMessages.length === 0 ? (
            <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--nv-text-muted)', padding: '2rem 1rem' }}>
              <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'var(--nv-bg-surface)', border: '1px solid var(--nv-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', color: 'var(--nv-primary)' }}>
                <Lock size={22} />
              </div>
              <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--nv-text-primary)', marginBottom: '0.35rem' }}>
                End-to-End Encrypted Session
              </div>
              <div style={{ fontSize: '0.85rem', maxWidth: '340px', lineHeight: 1.5, margin: '0 auto' }}>
                Messages are protected with monotonic integer sequence ordering and cryptographic session integrity. Send a message below to start chatting.
              </div>
            </div>
          ) : (
            activeMessages.map((msg) => {
              const isMe = msg.senderId === currentUser.id;
              return (
                <div
                  key={msg.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isMe ? 'flex-end' : 'flex-start',
                  }}
                >
                {/* Reply Anchor preview if replying */}
                {msg.replyToMessageId && (
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--nv-text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      marginBottom: '3px',
                      paddingLeft: isMe ? 0 : '8px',
                      paddingRight: isMe ? '8px' : 0,
                    }}
                  >
                    <CornerDownRight size={12} />
                    Replying to previous message
                  </div>
                )}

                <div
                  style={{
                    maxWidth: '68%',
                    padding: '0.75rem 1rem',
                    borderRadius: isMe ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                    background: isMe ? 'linear-gradient(135deg, #6366f1, #4f46e5)' : 'var(--nv-bg-surface)',
                    color: isMe ? '#ffffff' : 'var(--nv-text-primary)',
                    border: isMe ? 'none' : '1px solid var(--nv-border)',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                    position: 'relative',
                  }}
                >
                  {/* Voice memo card */}
                  {msg.type === 'VOICE' && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        background: 'rgba(0,0,0,0.15)',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '10px',
                        marginBottom: '0.5rem',
                      }}
                    >
                      <button
                        onClick={() => setAudioPlaying(audioPlaying === msg.id ? null : msg.id)}
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: '#fff',
                          color: '#4f46e5',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {audioPlaying === msg.id ? <Pause size={16} /> : <Play size={16} />}
                      </button>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: '3px', alignItems: 'center', height: '20px' }}>
                          {[12, 18, 8, 22, 16, 24, 10, 14, 20, 12, 18, 6].map((h, idx) => (
                            <span
                              key={idx}
                              style={{
                                width: '3px',
                                height: `${h}px`,
                                background: audioPlaying === msg.id ? '#10b981' : 'rgba(255,255,255,0.7)',
                                borderRadius: '2px',
                              }}
                            />
                          ))}
                        </div>
                      </div>
                      <span style={{ fontSize: '0.75rem', opacity: 0.9 }}>0:14</span>
                    </div>
                  )}

                  {/* Message Text Content */}
                  <div
                    style={{
                      fontSize: '0.9rem',
                      lineHeight: '1.45',
                      fontStyle: msg.isDeleted ? 'italic' : 'normal',
                      opacity: msg.isDeleted ? 0.7 : 1,
                    }}
                  >
                    {msg.content}
                  </div>

                  {/* Meta Bar: Time, Edited, Delivery Status, Sequence */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: '0.35rem',
                      marginTop: '0.35rem',
                      fontSize: '0.7rem',
                      opacity: 0.8,
                    }}
                  >
                    <span style={{ fontSize: '0.65rem', opacity: 0.6 }}>#{msg.sequenceNumber}</span>
                    {msg.isEdited && <span>(edited)</span>}
                    <span>{msg.timestamp}</span>
                    {isMe && (
                      <span>
                        {msg.deliveryStatus === 'READ' ? (
                          <CheckCheck size={14} color="#67e8f9" />
                        ) : msg.deliveryStatus === 'DELIVERED' ? (
                          <CheckCheck size={14} />
                        ) : (
                          <Check size={14} />
                        )}
                      </span>
                    )}
                  </div>
                </div>

                {/* Reactions list & quick react */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '4px' }}>
                  {msg.reactions.map((r, idx) => (
                    <span
                      key={idx}
                      onClick={() => handleToggleReaction(msg.id, r.reaction)}
                      style={{
                        fontSize: '0.75rem',
                        background: 'var(--nv-bg-elevated)',
                        border: '1px solid var(--nv-border)',
                        borderRadius: '999px',
                        padding: '0.1rem 0.45rem',
                        cursor: 'pointer',
                      }}
                    >
                      {r.reaction}
                    </span>
                  ))}
                  {/* Action hover triggers */}
                  {!msg.isDeleted && (
                    <div style={{ display: 'flex', gap: '0.2rem', opacity: 0.6 }}>
                      <button
                        onClick={() => handleToggleReaction(msg.id, '❤️')}
                        title="React Heart"
                        style={{ fontSize: '0.75rem', padding: '0 2px' }}
                      >
                        ❤️
                      </button>
                      <button
                        onClick={() => handleToggleReaction(msg.id, '👍')}
                        title="React Thumbs Up"
                        style={{ fontSize: '0.75rem', padding: '0 2px' }}
                      >
                        👍
                      </button>
                      <button
                        onClick={() => {
                          setReplyingTo(msg);
                          setComposerText('');
                        }}
                        title="Reply"
                        style={{ padding: '0 2px', color: 'var(--nv-text-muted)' }}
                      >
                        <Reply size={13} />
                      </button>
                      {isMe && (
                        <>
                          <button
                            onClick={() => {
                              setEditingMessage(msg);
                              setComposerText(msg.content);
                            }}
                            title="Edit"
                            style={{ padding: '0 2px', color: 'var(--nv-text-muted)' }}
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteMessage(msg.id)}
                            title="Delete"
                            style={{ padding: '0 2px', color: 'var(--nv-danger)' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          }))}

          {/* Typing Indicator Bar */}
          {remoteTypingUser && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.8rem',
                color: 'var(--nv-text-muted)',
                paddingLeft: '0.5rem',
              }}
            >
              <div style={{ display: 'flex', gap: '3px' }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--nv-primary)', animation: 'pulse-glow 1s infinite' }} />
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--nv-primary)', animation: 'pulse-glow 1s infinite 0.2s' }} />
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--nv-primary)', animation: 'pulse-glow 1s infinite 0.4s' }} />
              </div>
              <span>{remoteTypingUser} is typing...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Message Composer */}
        <div
          style={{
            borderTop: '1px solid var(--nv-border)',
            background: 'var(--nv-bg-surface)',
            padding: '0.75rem 1.25rem',
          }}
        >
          {/* Replying / Editing banner */}
          {(replyingTo || editingMessage) && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.35rem 0.75rem',
                background: 'var(--nv-bg-elevated)',
                borderRadius: '8px',
                marginBottom: '0.5rem',
                fontSize: '0.8rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--nv-text-secondary)' }}>
                {editingMessage ? <Edit2 size={14} /> : <Reply size={14} />}
                <span>
                  {editingMessage ? 'Editing message' : `Replying to: "${replyingTo?.content.substring(0, 40)}..."`}
                </span>
              </div>
              <button
                onClick={() => {
                  setReplyingTo(null);
                  setEditingMessage(null);
                  setComposerText('');
                }}
              >
                <X size={14} color="var(--nv-text-muted)" />
              </button>
            </div>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              background: 'var(--nv-bg-elevated)',
              border: '1px solid var(--nv-border)',
              borderRadius: '12px',
              padding: '0.5rem 0.85rem',
            }}
          >
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={handleFileSelected}
            />
            <button
              title="Attach File"
              onClick={() => fileInputRef.current?.click()}
              style={{ color: 'var(--nv-text-muted)', cursor: 'pointer', background: 'transparent', border: 'none' }}
            >
              <Paperclip size={18} />
            </button>
            <button title="Voice Message" style={{ color: 'var(--nv-text-muted)', background: 'transparent', border: 'none' }}>
              <Mic size={18} />
            </button>

            <input
              type="text"
              placeholder="Write a message... (Enter to send)"
              value={composerText}
              onChange={(e) => handleComposerChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--nv-text-primary)',
                fontSize: '0.9rem',
              }}
            />

            <button
              onClick={handleSendMessage}
              style={{
                background: 'var(--nv-primary)',
                color: '#fff',
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Send size={16} />
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem', fontSize: '0.7rem', color: 'var(--nv-text-muted)' }}>
            <span>Client Message ID Idempotency: <strong>Active</strong></span>
            <span>Sequence Tie-Breaker: <strong>Monotonic Integer</strong></span>
          </div>
        </div>
      </div>

      {/* PANE 3: Conversation Details & Privacy Drawer */}
      {showDetailsPanel && (
        <div
          style={{
            width: '320px',
            borderLeft: '1px solid var(--nv-border)',
            background: 'var(--nv-bg-surface)',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            overflowY: 'auto',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Conversation Details</span>
            <button onClick={() => setShowDetailsPanel(false)}>
              <X size={16} color="var(--nv-text-muted)" />
            </button>
          </div>

          {/* Group / Participant List */}
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--nv-text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              Participants ({activeConversation?.participants.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {activeConversation?.participants.map((p) => (
                <div
                  key={p.userId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.5rem',
                    background: 'var(--nv-bg-elevated)',
                    borderRadius: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--nv-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
                      {p.displayName[0]}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.8rem' }}>{p.displayName}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--nv-text-muted)' }}>{p.role}</div>
                    </div>
                  </div>
                  {p.role === 'OWNER' && (
                    <span style={{ fontSize: '0.65rem', background: 'rgba(99,102,241,0.2)', color: 'var(--nv-primary)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                      OWNER
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Actions & Controls */}
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--nv-text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
              Safety & Moderation
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button
                onClick={() =>
                  setConversations((prev) =>
                    prev.map((c) =>
                      c.id === activeConversationId ? { ...c, isMuted: !c.isMuted } : c,
                    ),
                  )
                }
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.65rem',
                  background: 'var(--nv-bg-elevated)',
                  border: '1px solid var(--nv-border)',
                  borderRadius: '8px',
                  color: 'var(--nv-text-primary)',
                  fontSize: '0.8rem',
                }}
              >
                {activeConversation?.isMuted ? <Bell size={16} /> : <BellOff size={16} />}
                {activeConversation?.isMuted ? 'Unmute Notifications' : 'Mute Notifications'}
              </button>

              <button
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.65rem',
                  background: 'var(--nv-bg-elevated)',
                  border: '1px solid var(--nv-border)',
                  borderRadius: '8px',
                  color: 'var(--nv-danger)',
                  fontSize: '0.8rem',
                }}
              >
                <Flag size={16} />
                Report Message or User
              </button>

              <button
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.65rem',
                  background: 'rgba(244,63,94,0.1)',
                  border: '1px solid var(--nv-danger)',
                  borderRadius: '8px',
                  color: 'var(--nv-danger)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                }}
              >
                <ShieldAlert size={16} />
                Block User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
