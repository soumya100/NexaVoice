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
} from 'lucide-react';

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

const CURRENT_USER: MockUser = {
  id: 'usr-current',
  nexaVoiceId: 'NV-901238',
  username: 'alex.rivera',
  displayName: 'Alex Rivera',
  isOnline: true,
};

export function MessagingWorkspace() {
  const [activeTab, setActiveTab] = useState<'chats' | 'contacts' | 'discovery'>('chats');
  const [activeConversationId, setActiveConversationId] = useState<string>('conv-1');
  const [composerText, setComposerText] = useState('');
  const [replyingTo, setReplyingTo] = useState<MockMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<MockMessage | null>(null);
  const [remoteTypingUser] = useState<string | null>('Elena Vance');
  const [showDetailsPanel, setShowDetailsPanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [audioPlaying, setAudioPlaying] = useState<string | null>(null);

  // Privacy Settings State
  const [privacySettings, setPrivacySettings] = useState({
    discoverableByUsername: true,
    discoverableByNexaVoiceId: true,
    readReceiptsEnabled: true,
    typingIndicatorsEnabled: true,
    whoCanMessageMe: 'EVERYONE',
  });

  // Conversations State
  const [conversations, setConversations] = useState<MockConversation[]>([
    {
      id: 'conv-1',
      type: 'DIRECT',
      title: 'Elena Vance',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      unreadCount: 0,
      lastMessageSnippet: 'The distributed consensus model passed latency benchmarks!',
      lastMessageTime: '10:42 AM',
      isMuted: false,
      participants: [
        { userId: 'usr-current', role: 'MEMBER', displayName: 'Alex Rivera', isOnline: true },
        { userId: 'usr-elena', role: 'MEMBER', displayName: 'Elena Vance', isOnline: true },
      ],
    },
    {
      id: 'conv-2',
      type: 'GROUP',
      title: 'Core Architecture Guild',
      description: 'Distributed protocols, real-time message sequencing, and cryptography review',
      avatarUrl: '',
      unreadCount: 3,
      lastMessageSnippet: 'Prisma migration completed with deterministic sequence tie-breakers.',
      lastMessageTime: '09:15 AM',
      isMuted: false,
      participants: [
        { userId: 'usr-current', role: 'OWNER', displayName: 'Alex Rivera', isOnline: true },
        { userId: 'usr-marcus', role: 'ADMIN', displayName: 'Marcus Chen', isOnline: true },
        { userId: 'usr-sarah', role: 'MEMBER', displayName: 'Sarah Jenkins', isOnline: false },
      ],
    },
    {
      id: 'conv-3',
      type: 'DIRECT',
      title: 'DevOps Security Bot',
      unreadCount: 0,
      lastMessageSnippet: 'AuditEvent: Key rotation verified for cluster us-east.',
      lastMessageTime: 'Yesterday',
      isMuted: true,
      participants: [
        { userId: 'usr-current', role: 'MEMBER', displayName: 'Alex Rivera', isOnline: true },
        { userId: 'usr-bot', role: 'MEMBER', displayName: 'DevOps Security Bot', isOnline: true },
      ],
    },
  ]);

  // Messages State
  const [messages, setMessages] = useState<Record<string, MockMessage[]>>({
    'conv-1': [
      {
        id: 'msg-1',
        conversationId: 'conv-1',
        senderId: 'usr-elena',
        clientMessageId: 'cli-8901',
        sequenceNumber: 1,
        content: 'Hi Alex! Did you finalize the Milestone 3 idempotency and message ordering specification?',
        type: 'TEXT',
        deliveryStatus: 'READ',
        isEdited: false,
        isDeleted: false,
        reactions: [{ userId: 'usr-current', reaction: '👍' }],
        timestamp: '10:35 AM',
      },
      {
        id: 'msg-2',
        conversationId: 'conv-1',
        senderId: 'usr-current',
        clientMessageId: 'cli-8902',
        sequenceNumber: 2,
        content: 'Yes! We adopted monotonic sequence counters with transactional outbox event streams, plus client-provided clientMessageId deduplication.',
        type: 'TEXT',
        deliveryStatus: 'READ',
        isEdited: false,
        isDeleted: false,
        reactions: [{ userId: 'usr-elena', reaction: '🚀' }, { userId: 'usr-current', reaction: '❤️' }],
        timestamp: '10:38 AM',
      },
      {
        id: 'msg-3',
        conversationId: 'conv-1',
        senderId: 'usr-current',
        clientMessageId: 'cli-8903',
        sequenceNumber: 3,
        content: 'Here is the voice briefing on the SSRF link preview filter and attachment scanning pipeline:',
        type: 'VOICE',
        deliveryStatus: 'READ',
        isEdited: false,
        isDeleted: false,
        reactions: [],
        attachments: [
          { id: 'att-1', fileName: 'voice-memo-arch-review.opus', mimeType: 'audio/opus', sizeBytes: 245000, voiceDurationMs: 14200 },
        ],
        timestamp: '10:40 AM',
      },
      {
        id: 'msg-4',
        conversationId: 'conv-1',
        senderId: 'usr-elena',
        clientMessageId: 'cli-8904',
        sequenceNumber: 4,
        content: 'The distributed consensus model passed latency benchmarks! Check out the specs at https://specs.nexavoice.internal/rfc-102',
        type: 'TEXT',
        deliveryStatus: 'READ',
        isEdited: false,
        isDeleted: false,
        reactions: [],
        timestamp: '10:42 AM',
      },
    ],
    'conv-2': [
      {
        id: 'msg-201',
        conversationId: 'conv-2',
        senderId: 'usr-marcus',
        clientMessageId: 'cli-m-01',
        sequenceNumber: 1,
        content: 'Prisma migration completed with deterministic sequence tie-breakers.',
        type: 'TEXT',
        deliveryStatus: 'READ',
        isEdited: false,
        isDeleted: false,
        reactions: [{ userId: 'usr-current', reaction: '🔥' }],
        timestamp: '09:15 AM',
      },
    ],
  });

  // Contacts State
  const [contacts, setContacts] = useState([
    { id: 'usr-elena', username: 'elena.vance', displayName: 'Elena Vance', nexaVoiceId: 'NV-772190', status: 'ACCEPTED', isOnline: true },
    { id: 'usr-marcus', username: 'marcus.chen', displayName: 'Marcus Chen', nexaVoiceId: 'NV-441029', status: 'ACCEPTED', isOnline: true },
    { id: 'usr-sarah', username: 'sarah.j', displayName: 'Sarah Jenkins', nexaVoiceId: 'NV-992381', status: 'ACCEPTED', isOnline: false },
  ]);

  const [pendingRequests, setPendingRequests] = useState([
    { id: 'req-1', requesterId: 'usr-turing', displayName: 'Alan Turing', username: 'aturing', nexaVoiceId: 'NV-191206', time: '10m ago' },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeConversationId]);

  const activeConversation = conversations.find((c) => c.id === activeConversationId);
  const activeMessages = messages[activeConversationId] || [];

  // Send Message with Idempotency Key
  const handleSendMessage = () => {
    if (!composerText.trim()) return;

    if (editingMessage) {
      setMessages((prev) => ({
        ...prev,
        [activeConversationId]: prev[activeConversationId].map((m) =>
          m.id === editingMessage.id ? { ...m, content: composerText.trim(), isEdited: true } : m,
        ),
      }));
      setEditingMessage(null);
      setComposerText('');
      return;
    }

    const clientMsgId = `cli-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newSeq = (activeMessages[activeMessages.length - 1]?.sequenceNumber || 0) + 1;

    const newMsg: MockMessage = {
      id: `msg-${Date.now()}`,
      conversationId: activeConversationId,
      senderId: CURRENT_USER.id,
      clientMessageId: clientMsgId,
      sequenceNumber: newSeq,
      content: composerText.trim(),
      type: 'TEXT',
      deliveryStatus: 'DELIVERED',
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

    setComposerText('');
    setReplyingTo(null);
  };

  // Toggle Reaction
  const handleToggleReaction = (messageId: string, emoji: string) => {
    setMessages((prev) => ({
      ...prev,
      [activeConversationId]: prev[activeConversationId].map((m) => {
        if (m.id !== messageId) return m;
        const hasReacted = m.reactions.some(
          (r) => r.userId === CURRENT_USER.id && r.reaction === emoji,
        );
        const updated = hasReacted
          ? m.reactions.filter((r) => !(r.userId === CURRENT_USER.id && r.reaction === emoji))
          : [...m.reactions, { userId: CURRENT_USER.id, reaction: emoji }];
        return { ...m, reactions: updated };
      }),
    }));
  };

  // Soft Delete
  const handleDeleteMessage = (messageId: string) => {
    setMessages((prev) => ({
      ...prev,
      [activeConversationId]: prev[activeConversationId].map((m) =>
        m.id === messageId ? { ...m, isDeleted: true, content: '[This message was deleted]' } : m,
      ),
    }));
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
                    onClick={() => setActiveTab('chats')}
                    style={{
                      padding: '0.35rem 0.65rem',
                      background: 'var(--nv-bg-elevated)',
                      border: '1px solid var(--nv-border)',
                      borderRadius: '6px',
                      color: 'var(--nv-primary)',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}
                  >
                    Chat
                  </button>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'discovery' && (
            <div style={{ padding: '1rem' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--nv-text-secondary)', marginBottom: '1rem', lineHeight: '1.4' }}>
                Find users by <strong>NexaVoice ID</strong> or <strong>Username</strong> without exposing private emails or phone numbers.
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <input
                  type="text"
                  placeholder="Enter NV-ID or username..."
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
                  style={{
                    background: 'var(--nv-primary)',
                    color: '#fff',
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                  }}
                >
                  Search
                </button>
              </div>

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
                      onChange={(e) => setPrivacySettings({ ...privacySettings, discoverableByUsername: e.target.checked })}
                    />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                    <span>Discoverable by NexaVoice ID</span>
                    <input
                      type="checkbox"
                      checked={privacySettings.discoverableByNexaVoiceId}
                      onChange={(e) => setPrivacySettings({ ...privacySettings, discoverableByNexaVoiceId: e.target.checked })}
                    />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                    <span>Read Receipts</span>
                    <input
                      type="checkbox"
                      checked={privacySettings.readReceiptsEnabled}
                      onChange={(e) => setPrivacySettings({ ...privacySettings, readReceiptsEnabled: e.target.checked })}
                    />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
                    <span>Typing Indicators</span>
                    <input
                      type="checkbox"
                      checked={privacySettings.typingIndicatorsEnabled}
                      onChange={(e) => setPrivacySettings({ ...privacySettings, typingIndicatorsEnabled: e.target.checked })}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
          {activeMessages.map((msg) => {
            const isMe = msg.senderId === CURRENT_USER.id;
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
          })}

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
            <button title="Attach File" style={{ color: 'var(--nv-text-muted)' }}>
              <Paperclip size={18} />
            </button>
            <button title="Voice Message" style={{ color: 'var(--nv-text-muted)' }}>
              <Mic size={18} />
            </button>

            <input
              type="text"
              placeholder="Write a message... (Enter to send)"
              value={composerText}
              onChange={(e) => setComposerText(e.target.value)}
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
